const dispatch = require('ut-function.dispatch');
const merge = require('ut-function.merge');
const babelfish = require('.');

module.exports = (...params) => {
    return dispatch({
        namespace: 'babelfish',
        methods: {
            async ready() {
                this.server = await babelfish(merge({
                    proxy: {
                        uri: this.bus.info().uri
                    }
                }, this.config));
            },
            stop() {
                return this.server?.stop();
            }
        }
    })(...params);
};
