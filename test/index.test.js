const got = require('got');
const keys = require('../keys');
require('ut-run').run({
    main: [
        () => ({
            test: () => [
                require('../dispatch'),
                (...params) => require('ut-function.dispatch')({
                    namespace: ['subject', 'login'],
                    methods: {
                        'subject.object.predicate': msg => msg,
                        'login.oidc.mle'() {
                            const {sign, encrypt} = this.bus.info();
                            return {sign, encrypt};
                        }
                    }
                })(...params),
                function validation() {
                    return [
                        ({ joi }) => ({
                            'subject.object.predicate': () => ({
                                description: 'subject object predicate',
                                params: joi.object(),
                                result: joi.object(),
                                auth: 'exchange'
                            }),
                            'login.oidc.mle': () => ({
                                method: 'GET',
                                path: '/.well-known/mle',
                                auth: false
                            })
                        })
                    ];
                }
            ]
        })
    ],
    method: 'unit',
    config: {
        test: true,
        utBus: {
            serviceBus: {
                jsonrpc: {
                    ...keys
                }
            }
        },
        babelfish: {
            server: {
                port: 8091
            },
            mle: {
                routes: [{
                    path: '/rpc/subject/object/predicate',
                    auth: 'exchange'
                }]
            },
            utLog: {
                streams: {
                    udp: false
                }
            }
        }
    },
    params: {
        steps: [
            {
                name: 'subjectObjectPredicate',
                params: () => got.post('http://localhost:8091/rpc/subject/object/predicate', {
                    json: {
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'subject.object.predicate',
                        params: {
                            test: true
                        }
                    }
                }).json(),
                result(msg, assert) {
                    assert.matchSnapshot(msg);
                }
            }
        ]
    }
});
