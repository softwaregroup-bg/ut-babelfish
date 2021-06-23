const Hapi = require('@hapi/hapi');
const H2o2 = require('@hapi/h2o2');
const Wreck = require('@hapi/wreck');
const bourne = require('@hapi/bourne');
const utConfig = require('ut-config');
const Logger = require('ut-log');
const {version, name} = require('./package.json');
const cert = require('ut-bus/cert');
const merge = require('ut-function.merge');
const got = require('got');

const babelfish = module.exports = async function babelfish() {
    const {
        server,
        proxy: {
            tls: proxyTls,
            ...proxy
        },
        log,
        utLog,
        mle
    } = utConfig.load({
        resolve: module.resolve,
        config: {
            implementation: 'babelfish',
            log: {
                level: 'info',
                name: 'proxy'
            },
            server: {
                host: 'localhost',
                port: 8091,
                tls: false
            },
            proxy: {
                passThrough: true,
                xforward: false,
                uri: 'http://localhost:8004',
                tls: false
            },
            utLog: {
                service: name,
                version,
                streams: {
                    stdOut: {
                        level: 'trace',
                        stream: 'process.stdout',
                        type: 'raw',
                        streamConfig: {
                            mode: 'dev'
                        }
                    },
                    udp: !process.browser && {
                        level: 'trace',
                        stream: '../udpStream',
                        streamConfig: {
                            host: 'localhost',
                            port: 30001
                        }
                    }
                }
            },
            mle: {
                routes: [
                    '/rpc/{path*}'
                ],
                sign: {
                    kty: 'EC',
                    d: 'zmnSC_P5Xzefte7vkdINXLAN2LeBgC0S5QTcPO2mI5vo62chc_zHAYhcobGPQGNJ',
                    use: 'sig',
                    crv: 'P-384',
                    x: 'G4JWlybVRkliYWLLFdXDj0CjMjnkXeyiunzQswR3izK-jxvMIYdjVB52Rty5yZN9',
                    y: 'JndKKF7RQf97idkaLPLsv_jkZPBw-MJFogDqri87vvnpAEf1qyHnQTmK_gAhLAgo',
                    alg: 'ES384'
                },
                encrypt: {
                    kty: 'EC',
                    d: 'Irx1Kg78ZY4xZPH_sNMWIe8ifpSB_6f9HZ-JRJiVMae0b_bitAC7Wld03t6KzCdB',
                    use: 'enc',
                    crv: 'P-384',
                    x: 'f-qS0J9HcmWeU2zmDYnjCMwcsEw9ozb0_XE5y2hi2NKUJEyTgeMuWynBpexlhXbS',
                    y: '22-bZgbttgc4G5lXBsoVMMV5-TYg41FjJY2uGtlJp-MSfJ2agzouRjpzrCihXi7z',
                    alg: 'ECDH-ES+A256KW'
                }
            }
        }
    });

    const logger = new Logger({...utLog, streams: Object.values(utLog.streams)}).createLog(log.level, log);
    try {
        logger?.info(`Starting version ${version}`);

        logger?.info('Init client MLE keys');
        const jose = require('ut-bus/jose')(mle);

        logger?.info(`Obtaining ${proxy.uri} MLE keys`);
        const targetKeys = await got(new URL('/rpc/login/.well-known/mle', proxy.uri).href).json();

        function createAgent() {
            if (!proxyTls) return;
            logger?.info('Loading client TLS configuration');
            const {Agent} = require('https');
            return new Agent(cert({tls: proxyTls}));
        }

        proxy.agent = createAgent();
        if (server?.tls?.key || server?.tls?.ca || server?.tls?.cert || server?.tls?.crl) {
            logger?.info('Loading server TLS configuration');
        }
        const httpServer = new Hapi.Server({...server, tls: cert(server.tls)});
        // if (this.config.capture) {
        //     await this.httpServer.register({
        //         plugin: require('ut-function.capture-hapi'),
        //         options: {name: this.config.id + '-receive', ...this.config.capture}
        //     });
        // }
        await httpServer.register([{plugin: H2o2, options: proxy}]);

        httpServer.ext('onPreResponse', (request, h) => {
            const response = request.response;
            if (response.isBoom) logger?.error(response);
            return h.continue;
        });

        httpServer.events.on('log', event => logger?.info(event));
        httpServer.events.on('start', () => logger?.info('Started', httpServer.info));

        mle.routes.forEach(route => httpServer.route(merge({
            method: 'POST',
            options: {
                payload: {
                    parse: false,
                    output: 'data',
                    allow: ['application/json', 'application/x-www-form-urlencoded']
                },
                handler(request, h) {
                    let path = '{path}';
                    let onResponse;
                    if (request.headers['content-type'] === 'application/json') {
                        const payload = bourne.parse(request.payload.toString('utf8'));

                        let keys;
                        const identityCheck = ['login.identity.check'].includes(payload.method);
                        if (identityCheck || payload.method.split('.').pop() === 'exchange') {
                            keys = {
                                mlsk: mle.sign,
                                mlek: mle.encrypt
                            };
                            if (identityCheck) {
                                path = '/rpc/login/identity/exchange';
                                payload.method = 'login.identity.exchange';
                            }
                        }
                        logger?.info(`Encrypting ${request.path}`);
                        payload.params = jose.signEncrypt(payload.params, targetKeys.encrypt, keys);
                        request.payload = JSON.stringify(payload);
                        onResponse = async function DecryptVerify(e, res, request, h, settings, ttl) {
                            const payload = await Wreck.read(res, {json: 'strict', gunzip: true});
                            logger?.info(`Decrypting ${request.path}`);
                            if (payload.error) payload.error = jose.decryptVerify(payload.error, targetKeys.sign);
                            if (payload.result) payload.result = jose.decryptVerify(payload.result, targetKeys.sign);
                            const response = h.response(JSON.stringify(payload));
                            response.headers = res.headers;
                            delete response.headers['content-length'];
                            delete response.headers['content-encoding'];
                            delete response.headers['transfer-encoding'];
                            return response;
                        };
                    }
                    return h.proxy({
                        ...proxy,
                        uri: proxy.uri + path,
                        onResponse
                    });
                }
            }
        }, typeof route === 'string' ? {path: route} : route)));

        httpServer.route({
            method: '*',
            path: '/{p*}',
            options: {
                auth: false,
                payload: {
                    parse: false,
                    output: 'stream'
                },
                handler: {
                    proxy: {
                        uri: proxy.uri
                    }
                }
            }
        });

        logger?.info(`Starting on ${server.host}:${server.port}`);
        await httpServer.start();
    } catch (error) {
        logger?.error(error);
        throw new Error('silent');
    }
};

if (require.main === module) {
    babelfish().catch(error => {
        // eslint-disable-next-line no-console
        if (error.message !== 'silent') console.error(error);
        // eslint-disable-next-line no-process-exit
        process.exit(1);
    });
}
