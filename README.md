# UT crypto proxy

Proxy for MLE and CBC

Listen on localhost and proxy requests to a remote URI.
It will encrypt JSON RPC requests and and decrypt responses.

## Project links

- [Continuous Integration (Jenkins)](https://jenkins.softwaregroup.com/view/master/job/ut/job/ut-babelfish/)
- [Static Code Analysis (SonarQube)](https://sonar.softwaregroup.com/dashboard?id=ut-babelfish%3Aorigin%2Fmaster)

## Usage

```npx ut-babelfish --proxy.uri=http://hostname:8004```

## Configuration

This module uses [ut-config](https://github.com/softwaregroup-bg/ut-config),
so it can be configured using command line, rc file, etc.

For example it will look for a file named `.ut_babelfish_devrc` in the
locations mentioned in `ut-config` readme.

Example YAML configuration, with the defaults:

```yaml
log:
    level: info
server:
    host: localhost
    port: 8091
    tls: false
proxy:
    passThrough: true
    xforward: false
    uri: http://localhost:8004
    tls: false
mle:
    routes:
        - /rpc/{path*}
    sign:
        kty: EC
        d: zmnSC_P5Xzefte7vkdINXLAN2LeBgC0S5QTcPO2mI5vo62chc_zHAYhcobGPQGNJ
        use: sig
        crv: P-384
        x: G4JWlybVRkliYWLLFdXDj0CjMjnkXeyiunzQswR3izK-jxvMIYdjVB52Rty5yZN9
        y: JndKKF7RQf97idkaLPLsv_jkZPBw-MJFogDqri87vvnpAEf1qyHnQTmK_gAhLAgo
        alg: ES384
    encrypt:
        kty: EC
        d: Irx1Kg78ZY4xZPH_sNMWIe8ifpSB_6f9HZ-JRJiVMae0b_bitAC7Wld03t6KzCdB
        use: enc
        crv: P-384
        x: f-qS0J9HcmWeU2zmDYnjCMwcsEw9ozb0_XE5y2hi2NKUJEyTgeMuWynBpexlhXbS
        y: 22-bZgbttgc4G5lXBsoVMMV5-TYg41FjJY2uGtlJp-MSfJ2agzouRjpzrCihXi7z
        alg: ECDH-ES+A256KW
```
