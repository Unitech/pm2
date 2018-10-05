
## 3.2.1 (5/10/18)

### Fix

- minor bug: fix bug when passing -i 'max' or -i 0

## 3.2.1 (3/10/18)

### Fix

- minor bug: get internal pm2 config after creation on new pm2 boots

## 3.2.0 (3/10/18)

### Features

- package.json version field retrieval and display in pm2 ls, pm2 show, pm2 monit
- pm2 internal configuration system via `pm2 set pm2:key value`, attached to pm2.user_conf
- add the .user field (CLI + Config) to set the user to start the application with
- add the .time field (CLI + Config) to enable default logs date prefix
- max_memory_restart now triggers a reload
- pm2 env <pm_id> command to display the environment the application is running with
- exponential backoff restart delay via `--exp-backoff-restart-delay <ms>` with reset mechanism
- new timing library on PM2 daemon (increase log througput, reduce CPU usage and memory usage)
- better user management system with username resolution to uid
- websocket default switch for pm2 plus
- new module management system (`pm2 package <folder>`, `pm2 publish <folder>`, `pm2 install <tarball>`)

### Fix

- @pm2/io 2.4 (restart > 10.0)
- restart behavior tested
- fix module version parsing
- module system refactoring (TAR + NPM)
- fix watch_delay in config file

## 3.1.3 (20/09/18)

### Features
- allow non-node application to run multiple instances without auto switch to cluster mode
- allow to call `pm2 logs` even without application (#3820)
- switch `pm2 link` and `pm2 plus` protocol to websocket by default instead of axon
- enhance the `pm2 init` template that generates ecosystem files by adding some extra fields

### Fix
- remove deprecation message for node 0.10
- pm2 login/register/monitor now hit the new oauth pm2 plus system

## 3.1.2 (10/09/18)

- version bump on @pm2/io

## 3.1.1 ( Mon Sep 10 2018 16:18:25 GMT+0200 (CEST) )


## Hot Fixes
  - #3901 fix error when installing module
  ([7b43fea5](https://github.com/Unitech/pm2/commit/7b43fea55d7c2853a3032b3bddd12201cd6a29e9))


## 3.1.0 ( Mon Sep 10 2018 10:25:13 GMT+0200 (CEST) )


## Bug Fixes
  - tmp fix io@beta + rename metric
  ([04ab7ac4](https://github.com/Unitech/pm2/commit/04ab7ac4e1312c5a5332f37cbb81b0d98686936d))
  - remove ending \n on git version comment
  ([9a36bfeb](https://github.com/Unitech/pm2/commit/9a36bfeb7e9f5ab1719ca3858510da08bb0cad6b))
  - #3883 fix typings for max_memory_restart and add wait_ready
  ([b35ea237](https://github.com/Unitech/pm2/commit/b35ea237e3b448088112b2f3a771a9c5286417a7))
  - restore monitored indicator
  ([34966432](https://github.com/Unitech/pm2/commit/349664329eb56232321694be9e08f16a3cda6fbd))
  - remove install of modules on pm2 plus command
  ([6a8bb269](https://github.com/Unitech/pm2/commit/6a8bb26952a7dcf109d28af7224b89faf0977a71))
  - invert kill/link
  ([3c37b528](https://github.com/Unitech/pm2/commit/3c37b5283bf0dea130fd375a5563974bd84543a9))
  - #3877 #3831
  ([16f4f2bc](https://github.com/Unitech/pm2/commit/16f4f2bc6589e8f0666f46d37c3f7f7739de7261))
  - #3865 ensure pm2 never run simultaneous gracefullExit, prevent dump file corruption
  ([79679db1](https://github.com/Unitech/pm2/commit/79679db1b321bbcc7296dbc41d005500cf61d273))
  - #3786 fix issue when triggering an action that does not exist
  ([1ff7fd3d](https://github.com/Unitech/pm2/commit/1ff7fd3d49ccaf3f65540774426b62fdc811e4f1))
  - fixed unstartup when launchd
  ([3d0461c3](https://github.com/Unitech/pm2/commit/3d0461c3e0a2362aef009e6f158b6f16b3d6510c))
  - access gl_retry as class property
  ([bbcb2b6b](https://github.com/Unitech/pm2/commit/bbcb2b6b5c5fa0ef872b64a648461c266350423a))
  - #3831 switch registerToKM() to register()
  ([8df2451e](https://github.com/Unitech/pm2/commit/8df2451e05bf5494b11f0546965718efe1f351b9))




## Features
  - add id column in stacked mode (80 char mode)
  ([83033d4c](https://github.com/Unitech/pm2/commit/83033d4cdeb899bc4c1d1fe7a8c6391e64e9d0d0))




## Refactor
  - only enable deep monitoring if explicitly stated
  ([f67e14f0](https://github.com/Unitech/pm2/commit/f67e14f0bd6d65bff6ef8f7e27e3f0aa93c60e40))
  - #3786 clean code
  ([6cbca8bc](https://github.com/Unitech/pm2/commit/6cbca8bccc0126f1557bf8326c81facc62100704))
  - removes unused imports.
  ([b8b48e83](https://github.com/Unitech/pm2/commit/b8b48e83f7f041508e39815e22501509259d4f26))
  - only import the necessary methods from async.
  ([6466ee44](https://github.com/Unitech/pm2/commit/6466ee44c1b85858f9b7e56b01aa6f2a08bde508))
  - removes unused async imports.
  ([679b14ff](https://github.com/Unitech/pm2/commit/679b14ff4b24519b5479c9e5f4ce0d9c32e39e55))




## Chore
  - upgrade to 3.1.0
  ([0285d12d](https://github.com/Unitech/pm2/commit/0285d12df335667e9e0311a7abe175796bb517f4))
  - update apm version
  ([cc27de4a](https://github.com/Unitech/pm2/commit/cc27de4a8b400f1c20ba2e4b12dadcef1dd34fae))
  - README update
  ([c505dcc1](https://github.com/Unitech/pm2/commit/c505dcc1685380728b23f8757aa80fa4387d7fd3))
  - remove unused console.log
  ([61e32a43](https://github.com/Unitech/pm2/commit/61e32a4305490cc64c0a40cd83e2ad48c133b272))
  - upgrade vizion to 2.0.2
  ([c231e286](https://github.com/Unitech/pm2/commit/c231e28604aa4628d8f8ba10ea1f9f82e73269e6))
  - #3415 try to update vizion to 2.0.1
  ([9b80d8c1](https://github.com/Unitech/pm2/commit/9b80d8c1b69c07d21e63441c266b7acafffe0673))
  - #3415 try to update vizion to 2.0.0
  ([2c3df093](https://github.com/Unitech/pm2/commit/2c3df09378a92bac9de2d3b3b83103e02bd1bb82))
  - update readme with 3.0.3 commits
  ([476542fb](https://github.com/Unitech/pm2/commit/476542fbad038b951b6cfe6d6903d7b6bc8540a5))




## Branchs merged
  - Merge branch 'master' into development
  ([95321c6d](https://github.com/Unitech/pm2/commit/95321c6dd2602e9ef71028731fd7a2e7b40a0d3c))
  - Merge branch 'master' into development
  ([c3c0e423](https://github.com/Unitech/pm2/commit/c3c0e423f9beeab25f53c0267d5f8a9e79d5c2e3))
  - Merge branch 'master' into development
  ([8e6481bc](https://github.com/Unitech/pm2/commit/8e6481bc9a6d23283895bf9cd3c7831c49a811ae))
  - Merge branch 'development' into development
  ([83294afe](https://github.com/Unitech/pm2/commit/83294afee7cf0204208e9cc7f4cf687469556492))
  - Merge branch 'development' into flag--ext
  ([79ab9242](https://github.com/Unitech/pm2/commit/79ab92425fef22cdf679fa77840d86a6e7cfc755))
  - Merge branch 'development' into post_install
  ([d5604300](https://github.com/Unitech/pm2/commit/d5604300685ace1c7dbd18776fd3df79da96f638))




## Pull requests merged
  - Merge pull request #3885 from Unitech/typings
  ([19a35e9b](https://github.com/Unitech/pm2/commit/19a35e9b23716df8f7d1301acf7b0f0b601f93dd))
  - Merge pull request #3878 from cuspymd/fix-command-help
  ([2d3d2044](https://github.com/Unitech/pm2/commit/2d3d204427ce02617aa134ca0831a844de1a697d))
  - Merge pull request #3876 from Unitech/lost_apps_sigterm
  ([4fa247a3](https://github.com/Unitech/pm2/commit/4fa247a3e370607cf4198743de41dfa0a94bfbb5))
  - Merge pull request #3874 from Unitech/trigger_no_action
  ([e868f003](https://github.com/Unitech/pm2/commit/e868f003e3063a57236cb8d0ead33af808e0df70))
  - Merge pull request #3872 from Unitech/column_id_stacked
  ([55b6ccc3](https://github.com/Unitech/pm2/commit/55b6ccc32ae02e574ec1f80a36b4531761b94777))
  - Merge pull request #3723 from livankrekh/development
  ([98f49dc3](https://github.com/Unitech/pm2/commit/98f49dc393efd1fed03a1ef8a5752c0e490dd4b8))
  - Merge pull request #3821 from imarakho/post_install
  ([4217b150](https://github.com/Unitech/pm2/commit/4217b1505419904252d0ae7640a51128a2459d98))
  - Merge pull request #3823 from imarakho/flag--ext
  ([cc68dc1f](https://github.com/Unitech/pm2/commit/cc68dc1f9faf010af0648992193230af609413c5))
  - Merge pull request #3822 from imarakho/flush_parameter
  ([bbcc85a4](https://github.com/Unitech/pm2/commit/bbcc85a41683f5fa573bf504894f8e817c89784a))
  - Merge pull request #3807 from medanat/minimize-async-lib-footprint
  ([7e92855f](https://github.com/Unitech/pm2/commit/7e92855ff5c394b5452db526d21262e343b89ef8))
  - Merge pull request #3829 from soyuka/patch-pidusage
  ([a668f576](https://github.com/Unitech/pm2/commit/a668f5762190061dd05de5c5d888b53f35fa386e))







## 3.0.3 ( Tue Aug 07 2018 23:35:05 GMT+0200 (CEST) )


## Bug Fixes
  - pm2 plus + register
  ([277ec6ba](https://github.com/Unitech/pm2/commit/277ec6ba8d1cdda7f8fdf11eb9d9d33c2c095d65))




## 3.0.2 ( Tue Aug 07 2018 23:35:05 GMT+0200 (CEST) )


## Bug Fixes
  - allow tracing activation
  ([f297ef1e](https://github.com/Unitech/pm2/commit/f297ef1ebbec292aedcfa48c27e3f31b8f206633))




## Branchs merged
  - Merge branch 'development'
  ([80c94dd3](https://github.com/Unitech/pm2/commit/80c94dd3261544f627612ce4b541356e4adbc51f))




## 3.0.1 ( Mon Jul 23 2018 14:13:35 GMT+0200 (CEST) )

## Bug Fixes
  - allow to set a name via pm2 link
  ([ebffb609](https://github.com/Unitech/pm2/commit/ebffb609cf4da195c72ee67d8341c63b78f0654e))
  - disable network monitoring as long as ampq not supported
  ([ae1547bf](https://github.com/Unitech/pm2/commit/ae1547bfa9505b2d13e30df39ce614eee29463b0))
  - display error message from pm2-deploy
  ([9171b810](https://github.com/Unitech/pm2/commit/9171b81024641c3e104f3eeb2e2c6eb852dbe7f4))
  - protect geteuid/getegid from being called on windows #3793
  ([0495bd8e](https://github.com/Unitech/pm2/commit/0495bd8e4ffaeb1db729b35fa569696145d79c5f))
  - put message module at the right level
  ([56f5e047](https://github.com/Unitech/pm2/commit/56f5e04787da29e8b582bf4fa8325f72404a2fbe))
  - do not ignore child pres folder
  ([10ee9987](https://github.com/Unitech/pm2/commit/10ee99876d75679723e1e8522da07413a618e48c))
  - let->var
  ([89e2a125](https://github.com/Unitech/pm2/commit/89e2a125c22aee27014c279c86d1d9e0a0df0235))
  - method renaming
  ([f3faa3d8](https://github.com/Unitech/pm2/commit/f3faa3d846d1e895232743dd619f5ecb15fdf7ad))
  - path
  ([4f980550](https://github.com/Unitech/pm2/commit/4f9805508d2c1c575aabc4abbab25728f1c6a28a))
  - #3791 mitigate pidusage errores
  ([88551b8c](https://github.com/Unitech/pm2/commit/88551b8cfe8bf8dd330d582e71b808faadfaf161))
  - pm2 plus
  ([9bc34e56](https://github.com/Unitech/pm2/commit/9bc34e56b7ad66cbc6efbd26d4017f1e1813a720))
  - #3764
  ([3a582b42](https://github.com/Unitech/pm2/commit/3a582b42f9cca57779b99964c95a2cd0516efa11))
  - drop coffee-script (installed via pm2 install coffeescript)
  ([76ceb2fd](https://github.com/Unitech/pm2/commit/76ceb2fd52a2e5acbf03deacc3fa8a120a197023))
  - restore no_interaction for pm2-dev
  ([902e5a5a](https://github.com/Unitech/pm2/commit/902e5a5a1225d2072ab6337aa067caf9c6a7cca4))
  - option -w doesn't work
  ([165a05c8](https://github.com/Unitech/pm2/commit/165a05c854f9b3dd1418b988c954d333f81ba88f))
  - retab shell script to use space for indent consistency
  ([e3b4327d](https://github.com/Unitech/pm2/commit/e3b4327d9a6120c5ad589734ca926d3b49a8b706))
  - set Makefile indent to tab instead of common space
  ([4db0ae01](https://github.com/Unitech/pm2/commit/4db0ae011c161cbfca9e250da40deff9fdc36069))
  - set yaml file indent to 2 spaces instead of 3
  ([e4ecb0b2](https://github.com/Unitech/pm2/commit/e4ecb0b29dbcc4c6ca2d67b6bdc7da4c0a5d17a5))
  - remove trailing spaces
  ([5c115983](https://github.com/Unitech/pm2/commit/5c1159832680231bff5da79f1c91caf32ce3b5e0))
  - fixes #3735
  ([0548cb82](https://github.com/Unitech/pm2/commit/0548cb82aa1193a5725ca22e1babfc38db2e3b77))




## Hot Fixes
  - fix #3767, do not consider as a command if space and slash are found
  ([d15a12ce](https://github.com/Unitech/pm2/commit/d15a12ceae8b0c9c27625180ae002178b0bfe5d0))
  - fix #3767, do not consider as a command if space and slash are found
  ([f8ec1503](https://github.com/Unitech/pm2/commit/f8ec1503c3e92bc0dec10d395ac682b116e2914e))




## Features
  - add inspector for node 10 and heap snapshot
  ([dc61bca6](https://github.com/Unitech/pm2/commit/dc61bca66828c16cf6fd04a6f749f127da697cec))
  - pm2 plus xx yy now generates a name with hostname-UID
  ([fcf75e2c](https://github.com/Unitech/pm2/commit/fcf75e2cc321791273f6afe86c07fd147c6e8414))
  - #3757 --only='app1,app2'
  ([bea98330](https://github.com/Unitech/pm2/commit/bea983306c4736d3a2b1090f2708b7b29c44ed03))
  - pm2 plus cli
  ([1da6edde](https://github.com/Unitech/pm2/commit/1da6edde80e3029d99084992ec1a4ada7b2cc279))
  - reload all apps after connection to pm2 plus
  ([35a1ed2a](https://github.com/Unitech/pm2/commit/35a1ed2a1328a859a7797ec8e22024d171599d86))
  - ask to install module after connection with KM
  ([68e87b39](https://github.com/Unitech/pm2/commit/68e87b39ae2b57e9fbb0b0abde68112c839f05ee))
  - with pm2 plus command ask to install modules
  ([28c61716](https://github.com/Unitech/pm2/commit/28c61716ee5e8f2402205e4b06ed7ee0a942a3cc))




## Test
  - test with development packages
  ([d361c840](https://github.com/Unitech/pm2/commit/d361c8405db47969bd68c7b1058a54f38e8e0e52))




## Chore
  - clean old snapshot method
  ([d064750b](https://github.com/Unitech/pm2/commit/d064750be0d437945efdcd6a5ce4e56547b1bce6))
  - update version to 3.0.1
  ([efbcb021](https://github.com/Unitech/pm2/commit/efbcb02180ae38dd930e43282113dbcb24288eab))
  - bump to 3.0.1
  ([fb8357e3](https://github.com/Unitech/pm2/commit/fb8357e32f9f015e5b6e7ed8ef150f59de382c6d))
  - new ascii logo + refactor pm2 plus command
  ([8692a1da](https://github.com/Unitech/pm2/commit/8692a1daf7b4b7dfb8a4d6ec3363ac0cc62203a8))
  - change motd.update + alias register to pm2 plus
  ([cdc4a767](https://github.com/Unitech/pm2/commit/cdc4a767d5f1ff5873d0466b471daa3006608604))
  - btn
  ([319fa0dc](https://github.com/Unitech/pm2/commit/319fa0dcbea331a88a9888c207368e52665309ce))
  - README button
  ([1c6fb68c](https://github.com/Unitech/pm2/commit/1c6fb68c758d76cf81e53c43c2423ecd742265e5))
  - remove duplicate configs in .editorconfig
  ([86ad52b8](https://github.com/Unitech/pm2/commit/86ad52b837e23a7ec92705d21a152394c244571f))




## Branchs merged
  - Merge branch 'development' into uid-gen
  ([5324c878](https://github.com/Unitech/pm2/commit/5324c878fd0d37e068bc25c8e37f19f73bfebf30))
  - Merge branch 'master' into development
  ([7d04f638](https://github.com/Unitech/pm2/commit/7d04f63835845e92d32d6ad7ffab166a2954302f))




## Pull requests merged
  - Merge pull request #3811 from Unitech/memory_inspector
  ([62018044](https://github.com/Unitech/pm2/commit/62018044d7a1ef7fd0b37fe3082da4bf05989de0))
  - Merge pull request #3801 from vkotovv/grammar-fixes
  ([9bb37a66](https://github.com/Unitech/pm2/commit/9bb37a662a91369caaa5a1a43751541e41970a51))
  - Merge pull request #3799 from Unitech/refactor-agent
  ([bcc4fea8](https://github.com/Unitech/pm2/commit/bcc4fea80885ce941e11b17936aab6582660fc7f))
  - Merge pull request #3787 from Unitech/multi-only
  ([ea5d74a8](https://github.com/Unitech/pm2/commit/ea5d74a87f6911b238634419665c716bc877be10))
  - Merge pull request #3788 from Unitech/uid-gen
  ([f70444f3](https://github.com/Unitech/pm2/commit/f70444f39b7cc8fe05faf57dac1b46fc15a2053c))
  - Merge pull request #3784 from Unitech/pm2-plus-cli
  ([e8c13c37](https://github.com/Unitech/pm2/commit/e8c13c374dfeabf42f75af50b838adb7ac4a50aa))
  - Merge pull request #3780 from Unitech/plus_modules
  ([466d2701](https://github.com/Unitech/pm2/commit/466d2701ca48d0c4b8466d6867135e43b22deeb5))
  - Merge pull request #3768 from Unitech/spaces
  ([0477354b](https://github.com/Unitech/pm2/commit/0477354b502aef612012e833bd47ce1940da1a0b))
  - Merge pull request #3771 from chinesedfan/patch-2
  ([8de987a6](https://github.com/Unitech/pm2/commit/8de987a604679774ec39e7d5a1a905556524c53d))
  - Merge pull request #3762 from shaharmor/issue-3441
  ([429e455d](https://github.com/Unitech/pm2/commit/429e455db96d2a56448a11b7602333324c9bf433))
  - Merge pull request #3761 from PeterDaveHello/fix-sh-indent-style
  ([24cddc25](https://github.com/Unitech/pm2/commit/24cddc257734beebb33ee5abac5a4107a5d86093))
  - Merge pull request #3737 from morugu/add-node-env-output
  ([6628f163](https://github.com/Unitech/pm2/commit/6628f1637497771bbc5c4f0ba0e9423c63660e0e))
  - Merge pull request #3743 from vivex/master
  ([06872c25](https://github.com/Unitech/pm2/commit/06872c2520f73bcabb6198a96c4dafb46706c9e9))
  - Merge pull request #3748 from JimiC/support_nvm4win
  ([2dac235b](https://github.com/Unitech/pm2/commit/2dac235bc8956d170fee2341517739d3781048d7))
  - Merge pull request #3752 from PeterDaveHello/upstart.tpl
  ([d4e66e3a](https://github.com/Unitech/pm2/commit/d4e66e3a9d954ab5c15d5bc35910cdfb71ba8321))
  - Merge pull request #3753 from PeterDaveHello/fix-editorconfig
  ([d1478680](https://github.com/Unitech/pm2/commit/d1478680325822c206afbcb197a9a732318f6d64))
  - Merge pull request #3754 from PeterDaveHello/remove-trailing-space
  ([b660f03e](https://github.com/Unitech/pm2/commit/b660f03eba71bb80a1a3d313be4525160727921f))






## 3.0.0 ( Wed Jun 20 2018 11:06:21 GMT+0200 (CEST) )


## Breaking changes
  - merge_logs is now activated by default if not in cluster mode. Logs will not be suffixed by the pm_id if only one app is started
  ([ae02adf6](https://github.com/Unitech/pm2/commit/ae02adf63f70ceb3bf101be968996ca68d9ce277))
  - Drop support for node 0.12
  - Drop gracefulReload command
  - Remove Interactor from PM2 source code
  - Replace pmx with [pm2-io-apm](https://github.com/keymetrics/pm2-io-apm)


## Bug Fixes
  - return the configuration and allow custom conf to override default values
  ([37dc7de1](https://github.com/Unitech/pm2/commit/37dc7de11e930aa4fce6a485e892f11ee714acd6))
  - add use strict for node 4 compatibility
  ([ba2ee3b1](https://github.com/Unitech/pm2/commit/ba2ee3b1ea9aa5fa665e706b3d49a205eac44d53))
  - #3605 fix parameters definition, don't use camelcase for properties
  ([c8616276](https://github.com/Unitech/pm2/commit/c8616276e4e08b4d90a742e219372e775bb81098))
  - #3695 change version check method in order to make it work with alpha/beta versions
  ([052d6c55](https://github.com/Unitech/pm2/commit/052d6c55df0e941e1dd11430bbcbcaa34061a06e))
  - deprecated warning on isbinaryfile
  ([db09275f](https://github.com/Unitech/pm2/commit/db09275f8e353e257c89e12fed754236b15cee74))
  - #3688 test adaptation + pm2 serve --port option
  ([f0249684](https://github.com/Unitech/pm2/commit/f0249684bcbfdb75749a516f447c8e8d32020709))
  - startup script issue 18.04 #3645
  ([ff1a7f31](https://github.com/Unitech/pm2/commit/ff1a7f315bfee38eb9fd9cdd63efcc0d971585f8))
  - that this - uncache node_modules
  ([294038d7](https://github.com/Unitech/pm2/commit/294038d76272a915e3addc67d3694717a9f7d704))
  - verify default conf variable via package.json on public module
  ([157b106d](https://github.com/Unitech/pm2/commit/157b106df78af1d28d37bbea069b926de4dceca5))
  - bug because of const
  ([56f05a90](https://github.com/Unitech/pm2/commit/56f05a900b03fb0c8dd635aede666c7d2f213271))
  - do not run two pm2 para cmds
  ([3274132b](https://github.com/Unitech/pm2/commit/3274132b866ba5c93d5786e755acbada922f5f1e))
  - version
  ([3ec178e5](https://github.com/Unitech/pm2/commit/3ec178e577e79730aae02c913301cd905ea8ce52))
  - re-enable agent tests
  ([e6febcd7](https://github.com/Unitech/pm2/commit/e6febcd70dd0f1e68b74df8563d3046ee3b32b89))
  - test/display summary
  ([b075e6d0](https://github.com/Unitech/pm2/commit/b075e6d09b09ff371adf045dc5079bb8ef82f1cf))
  - skip interactor tests
  ([36c4d6bc](https://github.com/Unitech/pm2/commit/36c4d6bca7445b46afc1236dc8ab4b8bf921148b))
  - remove unused tests
  ([234c6314](https://github.com/Unitech/pm2/commit/234c63143e723a508796bc1d323c7241979bf4c2))
  - add missing libraries in travis
  ([88fbb845](https://github.com/Unitech/pm2/commit/88fbb84597cee7029ce33f5b7e20e45f5a815b4b))
  - remove unused variable when trying to use tracing
  ([3aeeba02](https://github.com/Unitech/pm2/commit/3aeeba02f628bf4f19e8d5b93657fd94a6ef0ec7))
  - remove useless tests from .sh
  ([e0be81c8](https://github.com/Unitech/pm2/commit/e0be81c86c7defb5e7a271edd5cc37f960c6aa69))
  - conflict
  ([e13f39c9](https://github.com/Unitech/pm2/commit/e13f39c90b6a5e803c59c5424332520564703f5c))
  - fix bug with interpreter args
  ([b26efa0d](https://github.com/Unitech/pm2/commit/b26efa0d4cd72cf04762df7b7d2eaddc4f4117d2))
  - improve error message if action has failed
  ([d9f44f17](https://github.com/Unitech/pm2/commit/d9f44f170f115c2d6dfb6a7fe71dc31bd7fb66fb))
  - use polyfill module for copySync with node 4.x
  ([bc07f43b](https://github.com/Unitech/pm2/commit/bc07f43b115066f6077606df8f59379777f2a917))
  - improve error message if action has failed
  ([dacc6542](https://github.com/Unitech/pm2/commit/dacc654207cbe494af0d12a3f9f27c3b16541802))
  - solve empty list when no process and try to update pm2
  ([89511846](https://github.com/Unitech/pm2/commit/8951184688c720ded5b4b46bd5b393c3793f9b03))
  - #3485 fix issue when there is empty dump file
  ([f2523f6a](https://github.com/Unitech/pm2/commit/f2523f6a6b9d8b61ba6ace7b89a0353bee76360b))
  - #3456 use homedir() instead of process.env.HOME, make module installation work on windows
  ([1e001732](https://github.com/Unitech/pm2/commit/1e0017325fc8cf658263fb4e02c7bf8912f422b3))




## Features
  - add support for openbsd rc.d init scripts
  ([fdeb0c32](https://github.com/Unitech/pm2/commit/fdeb0c327afd91b113b214c4c4de187848f9f1cb))
  - add kill_retry_time argument
  ([b2cc0031](https://github.com/Unitech/pm2/commit/b2cc003114b44f1a9a31876ee4a2f4cb91e210b3))

  - **bin/pm2**
    - improve usage
  ([2c310084](https://github.com/Unitech/pm2/commit/2c310084453dd7b1546957e59b1fc7ef964d425b))




## Refactor
  - use @pm2/js-api for login/register on pm2.io via CLI
  ([cb6521ac](https://github.com/Unitech/pm2/commit/cb6521ac32f4737c42fc97fef972960bfe16c829))
  - keymetrics examples
  ([109b331d](https://github.com/Unitech/pm2/commit/109b331ddf37e061d1890ef952f4cd167ce53f64))
  - faster cli with less require
  ([ee5e6a06](https://github.com/Unitech/pm2/commit/ee5e6a06cbf93f2d1fa7fa022d6bdcad55a39695))
  - replace fs-extra with node calls
  ([4576b4c9](https://github.com/Unitech/pm2/commit/4576b4c97bc685c9d774018d6b29c918abd7cb8d))
  - centralize SECRET/PUBLIC/MACHINE_NAME + change some wordings
  ([d0a2a30e](https://github.com/Unitech/pm2/commit/d0a2a30e4110496b178199fb33e026d6402dd00d))
  - remove test deported to keymetrics-agent
  ([299a52a2](https://github.com/Unitech/pm2/commit/299a52a253d70edcde23cbd7e0c201d492984df4))
  - parallel test v1
  ([08612de5](https://github.com/Unitech/pm2/commit/08612de5b7893a004ae33ed77fcb2ee3ff7b2251))
  - e2e test rewrite
  ([2b9ffd4e](https://github.com/Unitech/pm2/commit/2b9ffd4eb493f1ff32c979e3811f4f1fedfae97d))
  - drop gracefullreload
  ([bb57c76d](https://github.com/Unitech/pm2/commit/bb57c76d4191343925013d4353299092d80732c9))
  - add node 4.x support
  ([d322dd00](https://github.com/Unitech/pm2/commit/d322dd00de0f527224c027b4fec5e86f12fd69ed))
  - create alias method instead of modify prototype
  ([6d8f0dfa](https://github.com/Unitech/pm2/commit/6d8f0dfae8106deb2fee0a7ae15b6ca9802a066d))
  - change safety var to const
  ([047aa494](https://github.com/Unitech/pm2/commit/047aa494d5c4dd4342915766b54d673db0d5cdf1))
  - drop some 0.x patch
  ([0cab8880](https://github.com/Unitech/pm2/commit/0cab8880ffa362cf27ab7d7b6a64d6b478dce7cd))
  - remove prototype from API and create method
  ([9552bd61](https://github.com/Unitech/pm2/commit/9552bd61b72692beb620a91765ad440cdf6abefe))
  - transform API into class
  ([e3831f95](https://github.com/Unitech/pm2/commit/e3831f95c8d71f98e8840da37f7e883727eccd59))
  - name tests well
  ([c3ccc651](https://github.com/Unitech/pm2/commit/c3ccc651d09ed7291090f516637b75bda99ff71c))
  - refactor e2e one line parallel
  ([93802711](https://github.com/Unitech/pm2/commit/938027117cdb2f300ee772ab27f008cbe22a4b19))
  - e2e rename
  ([8a7db95a](https://github.com/Unitech/pm2/commit/8a7db95aabc8437f292af0316cec81ab80ec41f5))
  - change params
  ([282186f2](https://github.com/Unitech/pm2/commit/282186f24b19b010999f7c7c49750935ef19c190))
  - parallelize bash test
  ([d4b4375e](https://github.com/Unitech/pm2/commit/d4b4375e16fe7ac463b252702da662d3a21bf8b4))




## Test
  - adapt test to new api
  ([7a275e27](https://github.com/Unitech/pm2/commit/7a275e279ea01b1239e9dd8b9cf8e088e407b96d))
  - refactor before/after
  ([b85ca3ca](https://github.com/Unitech/pm2/commit/b85ca3caa3c68e18f7ce6954cc85e90a9d33efef))
  - 3 concurrent jobs
  ([472aba34](https://github.com/Unitech/pm2/commit/472aba3499ff2d9d0eb834e819410026b1a44503))
  - move test
  ([9c973324](https://github.com/Unitech/pm2/commit/9c9733246dbe6afff1b488bc3ba3b6fea3877ea5))
  - move test
  ([952b7631](https://github.com/Unitech/pm2/commit/952b7631d19e1074ea73cc7a67bbaefe20950603))
  - fix test with km_link
  ([23fd8ecf](https://github.com/Unitech/pm2/commit/23fd8ecfea9b2bf61359f62a8e6e1a582c3b0d6e))




## Chore
  - shorten ecosystem file
  ([992a0452](https://github.com/Unitech/pm2/commit/992a045227aed559e708ac4e6bb3f54beabe48e0))
  - change motd wording
  ([aa183ba1](https://github.com/Unitech/pm2/commit/aa183ba19d88777d82619aa40499c2661d67879e))
  - merge master in development
  ([0e4453d9](https://github.com/Unitech/pm2/commit/0e4453d9cc789aa08ee778ff400572337e90d2e3))
  - keymetrics -> pm2
  ([2c8170c2](https://github.com/Unitech/pm2/commit/2c8170c25e231eb8827bb0944b76c2f4b041d84e))
  - upgrade all modules + keymetrics-agent -> pm2/agent + increase version enabling v8-compile-cache
  ([53ca18c1](https://github.com/Unitech/pm2/commit/53ca18c12868ab177b60a4edff2ccaa8127e301f))
  - pm2.io -> @pm2/io
  ([ae098962](https://github.com/Unitech/pm2/commit/ae098962df35eee7f482dc0a514fd29a02a5f4ad))
  - right names as pm2 maintainers
  ([e8cd7131](https://github.com/Unitech/pm2/commit/e8cd7131a6b9c9d497a2079bcbfc03770a753a06))
  - add changelog generation into contributing.md
  ([d77bfbc3](https://github.com/Unitech/pm2/commit/d77bfbc3c8929851ee19ea604b2a6481d03771e3))
  - cache node_modules
  ([81627e94](https://github.com/Unitech/pm2/commit/81627e94c72efa1f4d726e20bbf67f0bbd5c116f))
  - clone last 5 commits
  ([dad38ed1](https://github.com/Unitech/pm2/commit/dad38ed1bae849147f66e44186cd71c4b9cb022d))
  - delete old stagnating pmx inside test
  ([36834c2c](https://github.com/Unitech/pm2/commit/36834c2c00d496e04c38abaca30202eb650015c4))
  - pmx -> pm2.io
  ([adcbebc3](https://github.com/Unitech/pm2/commit/adcbebc3f6419cd97c5ea99f3c3a6789585bda66))
  - updgrade pmx-2
  ([eeeb2988](https://github.com/Unitech/pm2/commit/eeeb2988f8886e405aea107db3b888fc1fc929f8))
  - disable legacy test
  ([13723bd9](https://github.com/Unitech/pm2/commit/13723bd938d0e6fb1cbf35f15eabe91c52d87b58))
  - remove test for pmx alert system
  ([c43414a6](https://github.com/Unitech/pm2/commit/c43414a63438d724b8099eb531ec72bab23b8ca2))
  - sync from master
  ([3424ee27](https://github.com/Unitech/pm2/commit/3424ee27870feaf62fdf4509cce9015f8b1a8a2e))
  - add unique id for each process
  ([85a5ee0f](https://github.com/Unitech/pm2/commit/85a5ee0f1fd16da9635fb4b16ddcd8d53aca8224))
  - use npm install for CI as yarn has issue with npm
  ([52902186](https://github.com/Unitech/pm2/commit/5290218626af815f6cae8173bc78d21881a4dda8))
  - remove unused dependency
  ([830fc15f](https://github.com/Unitech/pm2/commit/830fc15fad1aee95e65b2681482b03369f1f97d7))
  - upgrade PM2 to 3.0
  ([4bc2eb4c](https://github.com/Unitech/pm2/commit/4bc2eb4c9a8179b9ae38438e98ce7650a91b64db))
  - remove unused console.log
  ([33db5084](https://github.com/Unitech/pm2/commit/33db5084814ae7940c90b7f933f9514d28008b78))
  - wording on error message
  ([c251c8c9](https://github.com/Unitech/pm2/commit/c251c8c97e6f18aae584cac6b7f3c83cf4f2de9c))
  - revert PR #3496
  ([aae1d55e](https://github.com/Unitech/pm2/commit/aae1d55e410c4dcfbbca83eaabbdf1a65d55f3aa))
  - fix issue with snapshot command + remove command forceGc
  ([97fd1010](https://github.com/Unitech/pm2/commit/97fd1010d005e59f2411042fa95891f9717fa8b7))
  - wording on error message
  ([5f78ecbf](https://github.com/Unitech/pm2/commit/5f78ecbf90f9f46a7feb2a169968e86b0ecac91e))
  - drop 0.12 test on travis
  ([beb6e487](https://github.com/Unitech/pm2/commit/beb6e48787c39c66569141d0fd8d090736114d23))
  - downgrade promptly
  ([074a7a40](https://github.com/Unitech/pm2/commit/074a7a407a31b4d88442f5834d253d62f4e543b8))
  - remove coffee and livescript dependencies
  ([13d6565c](https://github.com/Unitech/pm2/commit/13d6565c72e3596d05f87bfc8be15d3ee45fb279))
  - upgrade module version and engine version
  ([84796956](https://github.com/Unitech/pm2/commit/84796956347ca638750fe89cb5545e2a90a0f2c2))




## Branchs merged
  - Merge branch 'development' into chore/dev-cache-node-modules
  ([146c4e11](https://github.com/Unitech/pm2/commit/146c4e113c88e8ade17c7558c8e14cf523a3b2d6))
  - Merge branch 'development' of https://github.com/Unitech/pm2 into new-agent
  ([3514e7fa](https://github.com/Unitech/pm2/commit/3514e7fac624bb83b4cc22651ebc05385f9c284d))
  - Merge branch 'development' into master
  ([f5668331](https://github.com/Unitech/pm2/commit/f5668331dbe7346304258317a3b84450f421ed03))
  - Merge branch 'development' into new-usage-cli
  ([4ae27694](https://github.com/Unitech/pm2/commit/4ae27694e34c4bc6ed389566d71fc5ec48b69652))
  - Merge branch 'Eywek-improv/agent' into new-agent
  ([3e259dd1](https://github.com/Unitech/pm2/commit/3e259dd1d6bb96ea41897c49f3a84557c00c7dad))
  - Merge branch 'ecosystem-documentation' of github.com:rmonnier/pm2 into ecosystem-documentation
  ([98348955](https://github.com/Unitech/pm2/commit/98348955a6eb3a9cd524b991bd1dd6ed03d2c857))
  - Merge branch 'development' into ecosystem-documentation
  ([40157784](https://github.com/Unitech/pm2/commit/40157784a63bcb0e744d4ed56f6c687e28379fdd))
  - Merge branch 'inspect_mode' of github.com:Unitech/pm2 into inspect_mode
  ([7e1494c7](https://github.com/Unitech/pm2/commit/7e1494c7f7971aaf1f4d00d2ee691c3c41775001))
  - Merge branch 'development' of github.com:Unitech/pm2 into development
  ([48f81a8b](https://github.com/Unitech/pm2/commit/48f81a8b2f6f0db39edd86083fb369b74845c387))
  - Merge branch 'development' into master
  ([47e54109](https://github.com/Unitech/pm2/commit/47e5410987ab3d824a34c062d70c24ab686e57db))
  - Merge branch 'development' into module_install_windows
  ([7b82fb91](https://github.com/Unitech/pm2/commit/7b82fb916ed453c1c263bae43c962f6a5294d810))
  - Merge branch 'development' into module_install_windows
  ([80b0495f](https://github.com/Unitech/pm2/commit/80b0495f63d1224b850af4b14cdeb055e3fef50b))




## Pull requests merged
  - Merge pull request #3726 from soyuka/fix-list
  ([0255c5a6](https://github.com/Unitech/pm2/commit/0255c5a6ab1b8a8f609d2183d998695b8c42838d))
  - Merge pull request #3725 from soyuka/fix-list
  ([a39eb4f8](https://github.com/Unitech/pm2/commit/a39eb4f806e87565f53758a19f0ee289b6489b67))
  - Merge pull request #3718 from AaronM04/openbsd-init-script
  ([85458261](https://github.com/Unitech/pm2/commit/85458261d2673c609cb252d64ad4dfbaa466d848))
  - Merge pull request #3721 from Unitech/io_conf
  ([70ec1f81](https://github.com/Unitech/pm2/commit/70ec1f81eae089f75e82723fde7b0b3926d0a9bc))
  - Merge pull request #3716 from Unitech/io_conf
  ([0bc000b9](https://github.com/Unitech/pm2/commit/0bc000b9aae7dd37b456bc2d4fbc9eb4a9f047ef))
  - Merge pull request #3714 from Unitech/definition
  ([d8cff0de](https://github.com/Unitech/pm2/commit/d8cff0dec5160a620d1512ff56726c073368d1a4))
  - Merge pull request #3700 from Unitech/report_error
  ([4b2cad40](https://github.com/Unitech/pm2/commit/4b2cad407b76994e978074a2a3825fe70656304d))
  - Merge pull request #3670 from Unitech/changelog
  ([4bcbcce1](https://github.com/Unitech/pm2/commit/4bcbcce16ced596f6ca2bab2b77d608a174a7c1a))
  - Merge pull request #3662 from DanielRuf/chore/dev-cache-node-modules
  ([540590ee](https://github.com/Unitech/pm2/commit/540590ee056b44eed3b688a7b0b16ca78ec82cd9))
  - Merge pull request #3663 from DanielRuf/chore/dev-clone-last-5-commits
  ([bdf95fc9](https://github.com/Unitech/pm2/commit/bdf95fc997f9ab2995b23668f25f11b6e98b5c47))
  - Merge pull request #3584 from ngtmuzi/development
  ([33984b64](https://github.com/Unitech/pm2/commit/33984b64a2969ca4a3a5913f0f7da0242b6c5ec1))
  - Merge pull request #3500 from Unitech/test-parallel
  ([da56c7af](https://github.com/Unitech/pm2/commit/da56c7aff18d3a38b3ad068b22cd75b290bac9d0))
  - Merge pull request #3539 from KimSeongIl/master
  ([1325704d](https://github.com/Unitech/pm2/commit/1325704d95d324e56b0ebc86aed8137e0d0aa450))
  - Merge pull request #3556 from N-Nagorny/logs-smart-app-name-cutting
  ([bfddf4fd](https://github.com/Unitech/pm2/commit/bfddf4fdef5ec293119d850cc2532ac5d6490ae3))
  - Merge pull request #3553 from Unitech/fix_tracing_not_working
  ([9d51fe08](https://github.com/Unitech/pm2/commit/9d51fe0819182339f3a6a4aee7ea603ea3f4dd76))
  - Merge pull request #3549 from Eywek/new-agent
  ([2f04027b](https://github.com/Unitech/pm2/commit/2f04027b536094d192b399677b3a113102f06b8e))
  - Merge pull request #3548 from rmonnier/start-ecosystem-default
  ([55412f26](https://github.com/Unitech/pm2/commit/55412f263250395de0085144932cfe06b8c7180d))
  - Merge pull request #3546 from soyuka/improve-monitor-perf
  ([e4e29233](https://github.com/Unitech/pm2/commit/e4e29233f99db36462a6e8f48eb8ebd3d2fd9fa5))
  - Merge pull request #3534 from rmonnier/new-usage-cli
  ([5dfba8a4](https://github.com/Unitech/pm2/commit/5dfba8a4491f0bb83f2879915f0c4b164be2552c))
  - Merge pull request #3542 from rmonnier/default-start-ecosystem
  ([c65595f4](https://github.com/Unitech/pm2/commit/c65595f4a70659e1e0d753e6c28a1fcedf45a91a))
  - Merge pull request #3545 from rmonnier/default-ecosystem
  ([b3718656](https://github.com/Unitech/pm2/commit/b3718656f630aa54880343d9742534a2a508daec))
  - Merge pull request #3543 from rmonnier/ecosystem-documentation
  ([a60580a1](https://github.com/Unitech/pm2/commit/a60580a12b4a0066c8df6620317fbc8bf599b0b6))
  - Merge pull request #3541 from soyuka/development
  ([67e7a015](https://github.com/Unitech/pm2/commit/67e7a015cabaa7b08206a3b1bf9c0399af88f76b))
  - Merge pull request #3511 from Unitech/inspect_mode
  ([75fb87f8](https://github.com/Unitech/pm2/commit/75fb87f8a1c46a6db8e974b421e857175e69b535))
  - Merge pull request #3517 from Unitech/polyfill_fs_copy_node4
  ([524f5494](https://github.com/Unitech/pm2/commit/524f54948de5080632d43bb512038d7bd7271619))
  - Merge pull request #3516 from Unitech/drop_unused_feature
  ([9436f11a](https://github.com/Unitech/pm2/commit/9436f11aeecfc07e77aa9d6b108df4478b43402e))
  - Merge pull request #3510 from Unitech/dump_refacto
  ([674e4469](https://github.com/Unitech/pm2/commit/674e4469554e6a765bb3d57a3c083e6ab53b20cc))
  - Merge pull request #3501 from Unitech/refactor_api
  ([9f2c4ca4](https://github.com/Unitech/pm2/commit/9f2c4ca4c9eadf6c7730e3889c72e908cd2d8f5d))
  - Merge pull request #3496 from rmonnier/master
  ([829cc303](https://github.com/Unitech/pm2/commit/829cc3032b2d61e20f7a2e7d1d819c0ddc0845e8))
  - Merge pull request #3484 from Unitech/pull_by_name
  ([24d29404](https://github.com/Unitech/pm2/commit/24d294049008a0d01b2bc407b9b2b880d5843fbd))
  - Merge pull request #3482 from Unitech/mjs_support
  ([ebe7b048](https://github.com/Unitech/pm2/commit/ebe7b0487218557858aaa98527360eca1776b140))
  - Merge pull request #3495 from Unitech/module_install_windows
  ([e9c625d3](https://github.com/Unitech/pm2/commit/e9c625d3088c71eef4237ecd866b806957c61815))
  - Merge pull request #3507 from cheapsteak/patch-1
  ([a49287d6](https://github.com/Unitech/pm2/commit/a49287d6a1d22b39270e2d05dee2a17c0ed55797))




## 2.10.4 ( Thu May 17 2018 14:32:40 GMT+0200 (CEST) )


## Bug Fixes
  - #3645 throttle startup
  ([d529f675](https://github.com/Unitech/pm2/commit/d529f675d0240777cba95442ba35205c370cdb43))




## Chore
  - update issue and PR templates to use comments to hide instructions in the frontend
  ([9e0180ed](https://github.com/Unitech/pm2/commit/9e0180eddab071916144ad7008817bd6aef1c8ce))




## Pull requests merged
  - Merge pull request #3664 from DanielRuf/chore/update-issue-pr-templates
  ([067446f2](https://github.com/Unitech/pm2/commit/067446f2133ba7f761b0ad3c9f3692b167affd8b))


## v2.10.3 ( Fri Apr 27 2018 11:42:16 GMT+0200 (CEST) )


### Chore
  - upgrade for node 10
  ([cf7630e](https://github.com/Unitech/pm2/commit/cf7630e259742bdff8257cff4dbed2732bf24f9c))

## v2.10.2 ( Thu Mar 29 2018 13:06:11 GMT+0200 (CEST) )


## Bug Fixes
  - reinforce pm2-runtime auto exit strategy #3567 #3206
  ([e09cdbab](https://github.com/Unitech/pm2/commit/e09cdbabd0b479acda3cb24154bbaa071aa35407))




## Pull requests merged
  - Merge pull request #3569 from Unitech/pm2-runtime-hot-fix
  ([473a2d6d](https://github.com/Unitech/pm2/commit/473a2d6d3867c617e4a41571d1780618c5025b87))
  - Merge pull request #3547 from Unitech/revert-3532-logs-smart-app-name-cutting
  ([438e3030](https://github.com/Unitech/pm2/commit/438e303013e82ecc199cb68d018144cde8a0b2e6))
  - Merge pull request #3532 from N-Nagorny/logs-smart-app-name-cutting
  ([067c18e6](https://github.com/Unitech/pm2/commit/067c18e601aca4fac10101a7c23cc4c3525ad776))



## v2.10.1 ( Mon Feb 26 2018 11:38:18 GMT+0100 (CET) )


## Bug Fixes
  - restore --raw option #3476
  ([340011ca](https://github.com/Unitech/pm2/commit/340011cace2b90c2a1ead8d86baba517f5570e15))


## v2.10.0 ( Mon Feb 19 2018 14:51:19 GMT+0100 (CET) )


### Bug Fixes
  - add livescript in default modules
  ([a315eeb6](https://github.com/Unitech/pm2/commit/a315eeb65f04b22643a903f0cb1c0f416615ad8b))
  - replace dash with underscore
  ([203df768](https://github.com/Unitech/pm2/commit/203df7688ca348967c00bc45289ae70fd2c4aaaa))
  - make sure not pm2 is running
  ([bd798fd7](https://github.com/Unitech/pm2/commit/bd798fd748665e935db4bb91f9d1d66952d9842a))
  - auto-exit edge case fix + pm2 no daemon mode + log in raw by default + less logs
  ([704ae518](https://github.com/Unitech/pm2/commit/704ae518f5d7df0a631349e518d81cef51249a58))
  - impact v8 flag in fork mode also
  ([41bf6ef7](https://github.com/Unitech/pm2/commit/41bf6ef7d3633180b4c1e90f36eb206d82fab2b1))
  - fixup! #2182 Get rid of annoying popups in Windows 10
  ([3a85b59d](https://github.com/Unitech/pm2/commit/3a85b59de4a76796ad0880368d8d085a7ba55d36))




### Hot Fixes
  - \#3420 ([673acf36](https://github.com/Unitech/pm2/commit/673acf36b4ca1fd65c5135a92d56081f76237a8b))




### Features
  - add dependencies section into ecosystem.json file.
  ([828a30d0](https://github.com/Unitech/pm2/commit/828a30d0ccc88b3f6e2b66d517ccf5f2394bd08b))
  - --deep-monitoring available from pm2-runtime
  ([99e62e3b](https://github.com/Unitech/pm2/commit/99e62e3bb808f071d6e4850c234b34f7de65b1c2))
  - add deep_metrics to deep_monitoring flag
  ([4d1bea5e](https://github.com/Unitech/pm2/commit/4d1bea5e0bbaab1f16f75d012bca25702cdff88e))
  - add flag to enable deep-monitoring
  ([c5418688](https://github.com/Unitech/pm2/commit/c541868837a1c4421394de5dd1029d2619b5ac82))
  - allow pm2 to install a set of module as one single command and add deep-monitoring.
  ([9dddc80d](https://github.com/Unitech/pm2/commit/9dddc80db5e496def44d4d36716b7de54e5171cf))
  - pm2 pid <app_name> command
  ([6687d499](https://github.com/Unitech/pm2/commit/6687d499415151bd62489fed5331f414576ec354))
  - allow pm2 to install and enable event-loop-inspector data collecting
  ([e6b0c474](https://github.com/Unitech/pm2/commit/e6b0c47443d3e6a839bf29057ef0a80ef135c47e))
  - ignore signal when running in --no-daemon
  ([b9c01c99](https://github.com/Unitech/pm2/commit/b9c01c99d54aba98ab790b8888500ac0f0af05c9))
  - upgrade pmx to git development branch
  ([21be05a0](https://github.com/Unitech/pm2/commit/21be05a07bd93eacaddedde3b647c16468937473))
  - allow pm2 to enable v8 data collecting from pmx
  ([aa180fa8](https://github.com/Unitech/pm2/commit/aa180fa8ab47f0c687d7c21854d005ad0ebf8475))
  - allow pm2 to install gc-stats
  ([15634168](https://github.com/Unitech/pm2/commit/15634168582e4c7b3c5f47a3f58a0fcf8b732a76))
  - feat add changelog generation support
  ([14f53fc0](https://github.com/Unitech/pm2/commit/14f53fc0c28be4084778785aeace3763ed0d827f))

  - **pm2**
    - add pm2 init option to generate an ecosystem file
  ([5d56fac7](https://github.com/Unitech/pm2/commit/5d56fac7cc12590af29ee46c68ba32a82a2b813b))
    - add pm2 init option to generate an ecosystem file
  ([a38fd199](https://github.com/Unitech/pm2/commit/a38fd199b90d27a2405f8cabab0e4f6e45c69b08))




### Documentation
  - add documentation on new pm2 install command
  ([c90c453f](https://github.com/Unitech/pm2/commit/c90c453f85b07adb346bc55c2b685d689a2e96f7))
  - add sendDataToProcessId into typescript definitions
  ([4a2e8d2d](https://github.com/Unitech/pm2/commit/4a2e8d2d2c4b38fe0ff2377dfe32fce9a43c8044))




### Refactor
  - delete all "if" condition when installing new module, create an object with all modules and a generic installation process
  ([1b92a9c4](https://github.com/Unitech/pm2/commit/1b92a9c4000734367e68d8dbd60d0901009f4c56))
  - deep pm2-runtime refactor #3408 #3257 #3266
  ([c13b2364](https://github.com/Unitech/pm2/commit/c13b23648269529a1f998d816be10f895665861e))
  - no more interactive spinner for connection to KM + change pm2 log format + remove some logs
  ([d1916f40](https://github.com/Unitech/pm2/commit/d1916f40962b2cc8a1866172eab7d5d89db093be))




### Chore
  - pmx to 1.6.3-rc2
  ([41815e0b](https://github.com/Unitech/pm2/commit/41815e0ba0298979f936b3d4badb196f8d9783d8))
  - switch pmx to development
  ([748019d1](https://github.com/Unitech/pm2/commit/748019d1ef0cf760b5e8de9d5b6af6fee300db02))
  - 2.10.0-beta
  ([0d2b7172](https://github.com/Unitech/pm2/commit/0d2b7172a093d0638deabb5f23383cc9eec5dda9))
  - upgrade pmx to 1.6.3-next
  ([5a1b4343](https://github.com/Unitech/pm2/commit/5a1b4343cc1e1f5018e21451a111340351706213))
  - upgrade pmx dep
  ([4bbeec3d](https://github.com/Unitech/pm2/commit/4bbeec3d170ba63af0c0ae0e2d07beec2ab49772))
  - switch to published pmx(@next)
  ([859d18fb](https://github.com/Unitech/pm2/commit/859d18fbc79e2a2760fe90e9c17e71209f8177ce))
  - remove --exit from mocha.opts
  ([36bf03e1](https://github.com/Unitech/pm2/commit/36bf03e1eed69a27e518151e2f7aa958b15db2fb))
  - remove unused files
  ([65d233e5](https://github.com/Unitech/pm2/commit/65d233e5b5290f65796b7cf3daa20706e0f3bee6))




### Branchs merged
  - Merge branch 'development' of ssh://github.com/deltasource/pm2 into hotfix/scoped-package-support
  ([94ea9d9e](https://github.com/Unitech/pm2/commit/94ea9d9eeff40faca8aa9f7edfc81aa29c08e740))
  - Merge branch 'master' into development
  ([46606903](https://github.com/Unitech/pm2/commit/46606903f25d0f4d0eee226da863e20e4b396dc9))
  - Merge branch 'development' of github.com:Unitech/pm2 into v8_option
  ([757562f7](https://github.com/Unitech/pm2/commit/757562f755b09124bbd006209ae38a096d692529))
  - Merge branch 'development' of github.com:Unitech/pm2 into gc-stats
  ([3ed1a747](https://github.com/Unitech/pm2/commit/3ed1a7471aec7d79f7d604447ac7445720bdaced))
  - Merge branch 'master' into development
  ([ee7651e4](https://github.com/Unitech/pm2/commit/ee7651e47e944c3c829933494c6cc765deb4bb29))




### Pull requests merged
  - Merge pull request #3466 from natcl/development
  ([c6d7ace8](https://github.com/Unitech/pm2/commit/c6d7ace802e667def75bc68344effa4856830fb4))
  - Merge pull request #3464 from andyfleming/patch-1
  ([dd9ebb60](https://github.com/Unitech/pm2/commit/dd9ebb6051708ee5a13cc68dbcb8238e41860bb9))
  - Merge pull request #3459 from rmonnier/master
  ([46948a98](https://github.com/Unitech/pm2/commit/46948a98e90c7864f7b8100db5c519fe9d37f11a))
  - Merge pull request #3458 from Unitech/pm2_install_command
  ([f3b35726](https://github.com/Unitech/pm2/commit/f3b35726895bd82b92813f308b787d68e9df1fa4))
  - Merge pull request #3453 from deltasource/hotfix/scoped-package-support
  ([974f9bf0](https://github.com/Unitech/pm2/commit/974f9bf0dc7a7aa7ff6860f8640da3593b802296))
  - Merge pull request #3448 from Unitech/deep_monitoring_flag
  ([331bc741](https://github.com/Unitech/pm2/commit/331bc741d7285094738a91cd816bc9755cc76605))
  - Merge pull request #3447 from Unitech/deep-monitoring
  ([719d328e](https://github.com/Unitech/pm2/commit/719d328e8d14871b34fd33df54fd80f4f8e7825f))
  - Merge pull request #3443 from Unitech/event-loop-inspector
  ([77a35274](https://github.com/Unitech/pm2/commit/77a3527407f3d090c7a5fa0bedaf943a7536b5eb))
  - Merge pull request #3442 from Unitech/event-loop-inspector
  ([dad98e6e](https://github.com/Unitech/pm2/commit/dad98e6e0738983717fee155ff0f6519955ffc1b))
  - Merge pull request #3424 from Unitech/sendDataToProcessId_def
  ([95e85eef](https://github.com/Unitech/pm2/commit/95e85eef84510dddfb0c6b13f0ada38a7dd66cae))
  - Merge pull request #3438 from Unitech/v8_option
  ([e46b15dc](https://github.com/Unitech/pm2/commit/e46b15dc32c18e8b24f66da0c79cc06f91cf11b5))
  - Merge pull request #3437 from Unitech/gc-stats
  ([1a6771aa](https://github.com/Unitech/pm2/commit/1a6771aa361bb5718bafd6e33e616725f9c0d328))
  - Merge pull request #3400 from toddwong/windowsHide2
  ([f65e8794](https://github.com/Unitech/pm2/commit/f65e8794df6e67f4ff60dfbec7c05a37721cb6f9))
  - Merge pull request #3421 from Unitech/generate_changelog
  ([b0690618](https://github.com/Unitech/pm2/commit/b0690618d940c11e28eeb5115c060bf363c7b62b))
  - Merge pull request #3419 from Rohja/fix-build-number-deb-rpm
  ([b4343de2](https://github.com/Unitech/pm2/commit/b4343de2703fce03f3cf48cc303b12bc6b69b743))




## 2.9.2

- #3364 30% faster CLI via v8-compile-cache

- add process._getActiveRequests() and process._getActiveHandles() custom metrics
- #3402 #3360 fix bad username
- #3413 check dependencies before launching tests
- #3295 add sorting feature for process list (pm2 ls --sort <field_name:order>)
- #3404 if no gid specified - set gid to uid
- #3287 add typing for env
- #3374 separate stdout and stderr for pm2-docker/pm2-runtime
- #3366 improve building of rpm and deb packages
- #3375 sendLineToStdin/sendDataToProcessId fix
- #3365 fix report command for windows
- #3367 Display an error if the process is not found when running 'pm2 logs <process-name>'
- #3256 TypeError: Cannot read property 'destroy' of undefined
- User: append SUDO_USER if no uid has been set and SUDO_USER present
- User: check permission of agent
- KM: send outliers
- KM: infinite retry for km connection

## 2.9.1

- #3356 hot fix on startup system

## 2.9.0

- #3278 --silent -s now does not print welcome message
- #3345 #2871 #3233 pm2 -v will not spawn daemon anymore
- #3341 update moment dependency
- #3314 pm2 install <MODULE> --safe will now monitor new installation of module and will
  fallback to previous version if the module is failing (restart, fail on npm install)
- #3314 module folder structure refactoring to keep independent dependencies for each modules
- #3324 remove yarn installation of modules
- #3273 pm2 --mini-list now print the right pid file
- #3206 add flag to auto turn off auto exit with pm2-docker
- #3036 Fix applying env PM2_CONCURRENT_ACTIONS correctly
- #3346 do not chmod systemd script (was failing systemd script on orange pi)
- #3347 Add --wait-ip option to override systemd initialization to wait for internet full connectivity
- #3348 alias pm2-docker to pm2-runtime
- #3350 Override HOME and USER when setting --uid to start module or application
- #3351 alias pm2 ps to pm2 ls (docker style)

## 2.8.0

- #2070 Fix sendDataToProcessId not working (@h091237557)
- #2182 Add windowHide options in cluster mode (@soyuka)
- #3206 By default in docker, pm2 will auto exit when no process are online (@dguo)
- #3225 fix --lines accepting invalid values (@vmarchaud)
- #3036 fix when PM2_CONCURRENT_ACTIONS was overriden everytime on node > 4 (@danez)
- Add node 9 tests on CI (@Unitech)
- Add pm2 unlink command (eq to pm2 link delete) (@Unitech)
- Fix interactor to support custom endpoints (@vmarchaud)
- Allow custom PM2_HOME for docker (@lucidNTR)
- Support MJS module (@vpotseluyko)
- Allow custom service name for startup (@danez)
- Update PMX to 1.5 (@unitech)

## 2.7.2

- #3200 Associate .tsx files with ts-node (@dguo)
- #3202 Add first draft of typescript definitions (@jportela)
- Allow to install http url via pm2 install (@unitech)
- #3204 Given --uid add all its gids automatically (@jmeit)
- #3184 bugfix: try/catch around userInfo to avoid crash (@vmarchaud)
- #3181 force upgrade to latest pm2-deploy

## 2.7.1

- #3117 Add required node env on cluster mode start instance (2m0nd)
- make profiler compatible with Node.js 8

## 2.7.0

- #3150 fix watchdog on agent
- #3001 dump-backup feature
- #3134 edge case error handling
- #3096 fix module installation
- #3085 honor every pm2 args on restart
- #3046 better error message if PM2 is misconfigured
- #3058 pm2-docker now does not write logs by default
- #3045 continue to broadcast on the bus system even if logs are disabled
- [Docker] Auto Exit when no application is running
- [Keymetrics] pm2 unmonitor fix
- [Beta Container Support] beta pm2 start app.js --container
- [Chore] upgrade modules
- [Chore] enhance package.json

## 2.6.1

- #3037 bug fix cb

## 2.6.0

### Changes

- #2998 pm2 report command for automated system inspection
- #2997 --disable-logs option to suppress error
- #2290 allow to declare apps under "pm2" attribute (eq "apps"). Nicer in package.json
- #2994 allow to specify typescript version to be installed
- #2501 low memory environment pm2 setting via PM2_OPTIMIZE_MEMORY (beta)
- #2968 pm2 attach <pm_id> to attach to process stdin / stdout
- pm2-runtime -> drop in replacement for the node.js binary
- #2951 pm2 reload command locker via timestamped lock file
- #2977 pm2 reloadLogs protected
- #2958 Allow to delete attribute via --attribute null
- #2980 PM2_SILENT=true pm2 startup
- #2690 --parallel <number> command allows to change the nb of concurrent actions (reload/restart)
- expose cwd on CLI via --cwd
- multiple pm2-docker enhacements
- Alias pm2.link and pm2.unlink to pm2.interact and pm2._pre_interact
- Allow to customize kill signal via PM2_KILL_SIGNAL
- Support git+http in module installation
- force reverse interaction reconnection on internet discovery
- `--instances -1` when having a 1 cpu is no-longer spawning no processes #2953
- refactor the context retrieving from error
- add a TTL for file cache entry
- #2956 Fix listen_timeout in combination with wait_ready
- #2996 respect signal order on pm2 reload (delegate ready function to reload fn)

### Breaking

- Drop pm2-daemon CLI (replaced by pm2-runtime)

## 2.5

- `pm2 register|login` to create new account / login on Keymetrics + auto link
- `pm2 open` to open dashboard on browser
- `pm2 monitor|unmonitor <pm_id|name|all>` for selective monitoring
- #2818 alias pm2-docker to pm2-daemon
- #2809 correctly resolve git/npm repo when running pm2 install
- #2861 better auto exit check for docker
- #2870 avoid null error when preparing app config
- #2872 avoid showing useless warning
- #438 allow to override daemon config paths via env (example: `PM2_PID_FILE_PATH` to override pid file of the daemon)
- #2849 better gentoo template for pm2 startup
- #2868 allow tailing log with `--raw` flag
- #452 Add `PM2_WEB_STRIP_ENV_VARS` to remove environnement vars from `pm2 web` endpoint
- #2890 Fix wait-ready for cluster mode
- #2906 randomize machine name with default pm2 link
- #2888 allow to use regex for pm2 logs
- #2045 allow to rename NODE_APP_INSTANCE env variable
- #2809 add `increment_var` options to ask for a environnement variable to be incremented for each application started
- more informations when failing to deploy on custom ecosystem file
- fix tests for node 8
- fix missing callback when overriding console.log
- allow to rename daemon process name via `PM2_DAEMON_NAME`
- few typo in the readme

### Breaking change

- the NODE_APP_INSTANCE var behavior has been changed :
    - old behavior : when starting multiples instances of an app each one get an unique number, but its not working anymore if you are using `pm2 scale` (simply put its possible to have two application with the same number)
    - new behavior : the number are consistent, if you scale up/down it will take a number that isn't used by another application (so two application should never have the same number)

## 2.4.5/6

- #2818 alias pm2-docker to pm2-runtime
- #2815 polyfill for path.isAbsolute for node v0.11

### Breaking change

- rundev command has been dropped because of too low adoption

## 2.4.4

- #2806 fix reconnection to keymetrics

## 2.4.3

- #2759 disable default require of vxx in pmx
- #2651 always spawn pm2 daemon with `node` binary
- #2745 new issue template
- #2761 Make JSON log stream timestamp in consistent format
- #2770 Fix trigger API never calling callback
- #2796 Fix absolute path on windows
- [KM] profiler installation via `pm2 install v8-profiler` or `pm2 install profiler`
- [KM] Agent rescue system

## 2.4.2

- [KM] Disable pm2-server-monit auto install

## 2.4.1

- #2720 multi user startup script
- #2266 start and tail logs via `pm2 start app.js --attach`
- #2699 add back previous termcaps interface via `pm2 imonit`
- #2681 fix log folder create
- #2724 make sure process is stopped even if there is a restart_delay
- #2706 install pm2 modules via yarn if available
- #2719 show 15 logs line bu default
- #2703 allow custom timestamp with pm2-docker
- #2698 fix unicode on pm2 monit
- #2715 handle treekill edge case bug
- Optimize CPU usage of pm2 monit command
- [KM] URL web access dashboard
- [KM] Auto install pm2-server-monit on keymetrics linking
- [KM] Error reporting: add context (-B3 -A3 code lines)
- [KM] Transaction Tracer: reset routes on app restart / wait some time before sending

## 2.4.0

- #2631 new pm2 monit command (blessed dashboard!)
- #2670 allow to expose a folder over http via `pm2 serve <path> <port>`
- #2617 fix startup script generation on macosx (launchd)
- #2650 new option to append env name to app name (used to allow the same app to be launched in different environement w/o name conflict)
- #2671 allow to pass a delay to pm2-docker (`pm2-docker process.json --delay 10`)
- `pm2 ecosystem simple` to generate a simple ecosystem file
- aliasing: `pm2-dev <script>` <=> `pm2-dev start <script>`
- fix git parsing when using cwd
- #2663 allow to directly output json when logging (via log_type for JSON and --log-type via CLI)
- #2675 fix path when installing language module like typescript
- #2674 increase restart timeout for systemd startup
- #2564 allow to operate process (restart/reload/stop/delete) with regex

## 2.3.0

- Drop Node.js 0.10 support
- (CLI) remove immutability of CLI parameters on restart (critical for ux)
- Keymetrics VXX beta
- Alias "exec" to "script"
- `pm2 logs --nostream` allow to print last logs of application without attaching to logs bus #2620
- Added startup script for gentoo v2.3 via PR #2625
- optionalDependencies from http to https
- remove agent pid on exit
- #2646 check ps.stdout on treekil

## 2.2.3

- Various startup refactor fixes (#2598, #2587, #2590)

## 2.2.2

- #2574 Support Amazon systemv

## 2.2.1 (rc: 2.2.0@next)

- #2559 New startup system. Supported init system: systemd, upstart, launchd

  $ pm2 startup   # Auto detect available init system + Setup init scripts
  $ pm2 unstartup # Disable and Remove init scripts

*SystemD, Upstart and Launchd scripts work like a charm*

- #2515 New way to install PM2 on Debian based system:

```
$ wget -O - http://apt.pm2.io/ubuntu/apt.pm2.io.gpg.key | sudo apt-key add -
$ echo "deb http://apt.pm2.io/ubuntu xenial main" | sudo tee /etc/apt/sources.list.d/pm2.list
$ sudo apt-get update
$ sudo apt-get install pm2
```

- #1090 pm2 resurrect does not respawn the same processes
- #2544 Attach logs to exception
- #2545 Right exit code via pm2 api
- #2543 Fix module pid/mem monitoring
- #2537 Remove duplicated code in Configuration subsystem
- Responsive pm2 list (shortened list when < 90 columns)
- If not TTY do not print ascii table
- #2509 Trigger functions inside Node.js application from the PM2 CLI
- Rename pm2.triggerCustomAction() by pm2.trigger(<app_id>, <action_name>, [params], [cb])

## 2.1.6

- #2509 Trigger functions inside Node.js application from the PM2 CLI
- #2474 Resolve home path in configuration file
- #2526 Expose .launchAll() method to API
- #2351 inner pm2 actions - drop autorestart and node_args options
- #2530 Make sure all processes are killed on system signal to PM2
- #281 allow to combine PM2_SILENT + pm2 jlist to avoid extra data
- Alias attributes error_file to err_file + err_log + err, alias out_file to out, out_log
- Do not ask for pass for set/multiset from KM

## 2.1.5

- #2502 fix SIGTERM signal catch on pm2-docker
- #2498 #2500 global log rotation

## 2.1.4

- #2486 add --web option to pm2-docker command to expose web process api
- #2333 #2478 #1732 #1346 #1311 #1101 Fix GracefulShutdown SIGINT output + Better Stop process flow
- #2353 --wait-ready will wait that the application sends 'ready' event process.send('ready')
- #2425 allow to specify node.js version to be used or installed via interpreter 'node@VERSION'
- #2471 Make app environment immutable on application restart/reload by default for CLI actions
- #2451 Config file can be javascript files
- #2484 fix pm2 kill on windows
- #2101 pm2 ecosystem now generates a javascript configuration file
- #2422 allow to pass none to exec_interpreter
- Faster CLI load time, reduce load time by 1/4 (downgrade cli-table2 -> cli-table)
- Do not use disconnect() anymore on cluster processes
- Better Stop process flow: Upgrade TreeKill system + Wait for check
- Fix deploy issue with Windows
- Expose -i <instances> to pm2-docker
- Drop npm-shrinkwrap
- Upgrade chokidar (fix symlink), cron, fclone, shelljs
- Add yarn.lock

## 2.0.19

- #2466 skip cluster workaround / fix cluster mode for Node.js v7
- Enable Node v7 in travis

## 2.0.16/17/18

- #2400 Create log/pid default folder even if the root folder is already created
- #2395 CRON feature now call PM2 for app to be killed (allow to use SIGINT)
- #2413 #2405 #2406 do not exit on unhandledRejection auto catch
- pidusage upgrade to 1.0.8 to avoid util exception on windows when wmic fail
- Do no display error when pidusage try to monitor an unknow PID (modules)
- pm2-docker binary does not need the start option

## 2.0.15

- process.on('unhandledRejection'): allow to catch promise error that have not been catched
- upgrade fclone and pidusage (faster windows CPU/Mem monitoring)
- allow to call pm2 CLI from bash script managed by pm2
- #2394 fix pm2 id command
- #2385 ts-node upgraded to latest
- #2381 autocompletion fix

## 2.0.12 Bradbury

- Memory usage reduced by 40%
- CPU usage in overall situations reduced by 60%
- Refined pm2 logs command with --json, --format and --raw options
- Faster process management with CONCURRENT_ACTIONs enabled
- Faster installation (v1: ~30secs, v2: ~10secs)
- Faster `pm2 update` with Keymetrics linking delayed at the end
- Much better Module system with raw NPM feedback
- Better Windows support
- **pm2-docker** command with his official [Docker image](https://github.com/keymetrics/pm2-docker-alpine) + json output + auto exit
- **pm2-dev -> pmd** command enhanced (better log output, post-exec cmd)
- Watch and Reload instead of Watch and Restart
- New PM2 API, backward compatible with previous PM2 versions

The new PM2 API is greatly tested and well designed:

```javascript
var PM2 = require('pm2');

// Or instanciate a custom PM2 instance

var pm2 = new PM2.custom({
  pm2_home :    // Default is the legacy $USER/.pm2. Now you can override this value
  cwd      :    // Move to CWD,
  daemon_mode : // Should the process stay attached to this application,
  independant : // Create new random instance available for current session
  secret_key  : // Keymetrics secret key
  public_key  : // Keymetrics public key
  machine_name: // Keymetrics instance name
});

// Start an app
pm2.start('myapp.js');

// Start an app with options
pm2.start({
  script   : 'api.js',
  instances: 4
}, function(err, processes) {
});

// Stop all apps
pm2.stop('all');

// Bus system to detect events
pm2.launchBus((err, bus) => {
  bus.on('log:out', (message) => {
    console.log(message);
  });

  bus.on('log:err', (message) => {
    console.log(message);
  });
});

// Connect to different keymetrics bucket
pm2.interact(opts, cb)

// PM2 auto closes connection if no processing is done but manually:

pm2.disconnect(cb) // Close connection with current pm2 instance
pm2.destroy(cb)    // Close and delete all pm2 related files of this session
```

- Better CLI/API code structure
- PM2 isolation for multi PM2 instance management

### Bug fixes

- #2093 #2092 #2059 #1906 #1758 #1696 replace optional git module with tgz one
- #2077 fix calling pm2.restart inside pm2
- #2261 GRACEFUL_LISTEN_TIMEOUT for app reload configurable via --listen-timeout
- #2256 fix deploy command for yaml files
- #2105 alias pm2 logs with pm2 log
- Extra module display http://pm2.keymetrics.io/docs/advanced/pm2-module-system/#extra-display
- Yamljs + Chokidar Security fixes
- pm2 update / pm2 resurrect is now faster on Node > 4.0
- keymetrics linking after pm2 update is done once all apps are started
- pm2 list processes are now sorted by name instead id
- #2248 livescript support added in development mode
- The client/server file called Satan.js does not exist anymore. It has been replaced by the file combo ./lib/Client.js and ./lib/Daemon.js
- PM2 --no-daemon is better now

### Breaking change

- Coffeescript must be installed via `pm2 install coffeescript`

## 1.1.3

- Node v6 compatibility

## 1.1.2

- [#2071 #2075] Fix pm2-dev command

## 1.1.0: Galactica release

This release is about PM2's internals refactoring, homogenization in action commands (in terms of behavior and outputs).
Some interesting features has been added, as YAML file support (for application declaration) and some syntaxic sugar.
The Keymetrics interface has been enhanced, dividing by two the memory usage and avoiding any possible leak in any potential scenarios. Reconnection system has been refactored too, we kindly ask our Keymetrics users to upgrade to this version ASAP.

**This version has been heavily tested in testing, production environments and deeply monitored in terms of CPU and Memory usage.**

- [#133 #1568] Allow to rename a process via pm2 restart app --name "new-name"
- [#2002 #1921 #1366] Fix CLI/JSON arguments update on restart (args, node_args, name, max-memory)
- [#578] Add YAML support for application configuration file (in extent to JSON and JSON5 support)
- [Keymetrics agent refactoring] TCP wait, memory consumption divided by two, reconnection refactoring, keep alive ping system
- [Keymetrics agent refactoring] Fix random no response from pm2 link and pm2 unlink
- [#2061] Kill ESRCH of processes in cluster mode with SIGINT catcher fixed
- [#2012 #1650 #1743] CLI/JSON arguments update on reload
- [#1613] Reload all reload ALL applications (stopped, errored...)
- [#1961] Fix kill timeout info log
- [#1987] Fix FreeBSD startup script
- [#2011] Respect process.stdout/.stderr signature
- [#1602] Fix zombie process when using babel-node as interpreter
- [#1283] --skip-env option to not merge update with system env
- Homogeneize actions commands outputs
- Option --interpreter-args added (alias of node-args)
- Allow to use exactly the same option in JSON declaration and CLI (e.g. interpreter) to avoid confusion
- pm2 show, now shows more commands to manage processes
- Refactor programmatic system

## 1.0.2

- [#1035 #1055] Deactivate automatic dump on startup scripts
- [#1980] Add Javascript source map resolution when exceptions occurs [Documentation](http://pm2.keymetrics.io/docs/usage/source-map-support/)
- [#1937] Allow to act on application having numerics as app name
- [#1945] Fix post_update commands section when file contains Javascript
- [#624] --only <app-name> to act only on specified app name in json app declaration
- [0.6.1](https://github.com/keymetrics/pmx/releases/tag/0.6.1) PMX upgrade

## 1.0.1

- [#1895] pm2 id <app_name>: output array of ids for app_name @soyuka
- [#1800] pm2 show <app_name>: now also display node.js version @soyuka

## 1.0.0

- [#1844][#1845][#1850] Load configuration in /etc/default/pm2 + add ulimit -n override
- [#1810] Add --kill-timeout <number> option (delay before process receive a final SIGKILL)
- [#1830] Add tests for PM2_KILL_TIMEOUT (SIGKILL delay) + default SIGINT to any kind of procs
- [#1825] Process management commands (start/restart/stop/delete) can take multiple arguments
- [#1822] Add new method pm2.sendDataToProcessId(type|data|id) to send data to processes
- [#1819] Send SIGINT signal to process instead of SIGTERM
- [#1819][#1794][#1765] Avoid writing on std err/out when process is disconnected

- Add default attribute in schema.json to allow to configure default value when passing a JSON
- JSON and CLI starts are now consistent in terms of option size, attribute number
- pm2.restart(json_data, function(err, data) now returns an array of process instead of simple object (success:true))
- Now pm2 restart process.json --env <X>, refresh environment variable on each restart depending of the X environment
- prepareJSON method in PM2 code (God.js) removed
- partition Common.prepareAppConf (duplicate with verifyConfs)
- Change signature of Common.prepareAppConf
- Centralize Interpreter resolution via Common.sink.resolveInterpreter(app) in Common.js

- Better meta information when process restart/reload/stop (signal + exit code)
- Upgrade pm2-axon, cron, should, mocha, coffee-script, chokidar, semver NPM packages
- Show process configuration option when describing process
- Add --no-automation flag
- Fix when starting application with illegal names (#1764)
- Fix management of app starting with numerics in the filename (#1769)
- Fix versiong system (reset to default on resurrect/prepare)
- Increase buffer size for versioning meta parsing

## 0.15.10

- Hot fix #1746

## 0.15.9

- Chokidar upgraded to 1.2
- Fix startup script via new --hp option
- Fix JSON refresh system

## 0.15.1-8

- JSON refresh available
- New module system backward compatible and compatible with NPM 3.x
- Possibility to install module from tgz (#1713)
- ecosystem generated file via pm2 generate uptaded (not json5 prefix anymore, and updated comments)
- always prefix logs #1695
- blessed dependency removed
- drop locking system
- add callback to deploy (#1673)
- typo fixes
- pm2.update added
- small db for pm2 modules added (solve npm 3.x issue)
- pm2 multiset "k1 v1 k2 v2 k3 v3"
- babel dependency removed
- blessed dependency removed
- chalk, safe-clone-deep, shelljs, semver upgraded
- New command: pm2 module:update <module_name> -> Update a module
- New command: pm2 module:publish  -> Publish module in current folder + Git push
- New command: pm2 module:generate [module name] -> Generate a sample module
- Feature: configuration system for raw Node.js applications
- alias pm2 install with pm2 i
- JSON declaration: You can now use process.env in application declaration file
- watch has been refactored for windows and tests
- allow installation of specific module version
- wrap final process kill intro try catch (c4aecc8)
- Appveyor to test PM2 under Windows added (+ fix some incorect file name)
- Allow to escape key name when using pm2 conf system

## 0.14.7

- New flag `--no-pmx` : starts an app without injecting pmx
- New feature : cron restart now works in fork mode as well
- Disabled auto-gc on interactor
- Allow PM2 to execute binaries in $PATH
- pm2 link priv pub --recyle for elastic infrastructure
- pm2 deploy now check default file ecosystem.js[on|on5], package.json

## 0.14.6

- Scoped PM2 actions
- Password encryption via pm2 set pm2:passwd xxxx
- Interactor Remote action refactor
- .getSync method to get configuration variable synchronously
- Add password protected PM2 methods (install, delete)
- pm2 get|pm2 conf display all confs
- Password protected PM2 flag
- New flag : `--restart-delay <ms>` (or `restart_delay` in JSON declaration)
- New command : `pm2 deepUpdate`
- New command (beta) : `pm2 logrotate`
- Enhancement : pm2 handles processes that can't be killed in a better way
- Fix : some ignore_watch issues
- Fix : some pm2 startup systemd issues

## 0.14.5

- Hot fix

## 0.14.4

- New command : `pm2 iprobe [app_name|app_id|'ALL']`
- Feature: FreeBSD startup script
- Fix: Remove forced GC
- Fix: ##1444 --next-gen-js in fork mode
- Fix: Windows path fix

## 0.14.3 (Current Stable)

- `pm2 flush` now flushes pm2.log as well
- New flag : `--no-treekill` : when used PM2 won't kill children processes
- New flags : `pm2 logs ['all'|'PM2'|app_name|app_id] [--err|--out] [--lines <n>] [--raw] [--timestamp [format]]`
- Enhancement: Modules installable via Github: `pm2 install username/repository`
- Feature: PMX has *scoped function* -> pm2 stores temporary output from custom functions
- Fix: Interactor issue when doing an heapdump
- Feature: PM2 CLI autocompletion

## 0.14.2

- Improved pm2-dev
- Now when apps list is empty, the `id` counter is set to 0
- Removed pres/keymetrics.js post-install script
- Fix : `pm2 logs` allocation error
- Fix : `pm2 prettylist|jlist` truncated output

## 0.14.0 - CrystalClear (pre 1.0)

- Removed: pm2.startJSON() method, now call pm2.start()
- API Change: pm2 start <app_name|app_id> restart an application already launched
- API Change: pm2 start <json> restart all json apps if already launched
- pm2 start all - restart all applications
- pm2 reload <json_file> possible
- pm2 gracefulReload <json_file> possible
- Smart start (pm2 start app.js ; pm2 stop app ; pm2 start app)
- Reduced memory footprint
- Reduced pipelined data
- Reduced CPU usage
- Faster command processing
- Upgrade shelljs, semver, colors, chalk, coffee-script, async, json-stringify-safe, cron, debug, commander
- Fix: launchBus() only connects and disconnects once

- Refactored `pm2 logs` :
  - Now you don't need to install tail on Windows
  - You don't need to Ctrl^C and `pm2 logs` again when a new app is launched (this one will be detected and added to the real-time logs output)
  - Logs are shown in chronological order at a file level (modified date)
  - More verbosity : tailed logs are explicitely separated from the real-time logs
  - Real-time logs now use the `bus` event emitter
  - PM2 logs added to the `bus`
  - `--lines <n>` and `--raw` flags available for `pm2 logs` command
  - New flag : '--timestamp [format]' // default format is 'YYYY-MM-DD-HH:mm:ss'
  - Now you can exclusively show PM2 logs by doing `pm2 logs PM2`

## 0.12.16

- Feature : File transmission added in Agent
- Feature : Transmit Node.js/io.js version in Agent
- Feature : Parameters can be passed to remote actions
- Feature : Support JS in addition to JSON and JSON5 config files #1298
- Enhanced: pm2 conf display all configuration values
- Enhanced: pm2-dev
- Enhanced: Better error messages when validating data passed via CLI
- Enhanced: Smaller memory footprint for PM2 (~30%)
- Fix #1285 : PID file was deleted after a reload/gracefulReload
- Fix : ENOMEM made PM2 crash

## 0.12.15

- Fix #941 : Env variables overrided when an app is restarted
- max_memory_restart now performs a graceful reload
- `pm2 logs --raw` now shows 20 last lines of each log file
- pm2-dev run app.js : start an app in dev mode (--no-daemon --watch and stream logs of all launched apps)
- --no-daemon command now display logs of all processes (Docker)

## 0.12.14

- `ilogs` is no longer part of PM2
- Improved interaction with Keymetrics
- BabelJS is now integrated into PM2 (`--next-gen-js` flag)

## 0.12.13

- Enhanced  : PM2 doesn't leave processes behind when it crashes
- Enhanced  : Call reload instead of restart when max-memory-limit reached
- Enhanced  : Modules are compatible ES6 by default by adding --harmony flag
- Enhanced  : Dump feature is now smarter
- Fix #1206 : fix `pm2 logs` bug when merged_logs
- Fix       : pm2 scale doesn't try to scale a fork_mode process

## 0.12.12

- `pm2 logs --raw` flag : show logs in raw format
- New command: pm2 scale <app_name> <number> - scale up/down an application
- Fix #1177 : no concurrent vizion.parse() for the same process event when it restarts
- Added: Expose kill method programmatically
- Added: Call disconnect without a function
- Added: Programmatic call to .connect can now take no-daemon-option
- Fixed: starting a JSON programmatically return a process list coming from God
- Fixed: Reflect dump functions from CLI and God
- Enhanced: New CLI API for configuring modules (pm2 conf module.option [value])
- Added: Using Keymetrics harden PM2 by enabling a WatchDog that auto restart PM2 in case of crash
- Added: Expose pm2 gc programmatically
- Added: pm2 install <module_name> update the module
- Enhanced: 4 new test suits for PM2 programmatics call
- Enhanced: Documentation restructured

## 0.12.11

- `--no-autorestart` flag : starts an app without automatic restart feature
(`"autorestart" : false` in JSON declaration)

- `--no-vizion` flag : starts an app completely without vizion features
(`"vizion" : false` in JSON declaration)

- Fix #1146 : add module._initPaths() on ProcessContainer.js so it forces each
new process to take the current NODE_PATH env value in account

- New: pm2.start() now handles json objects as param

- Added: timestamps to KM agent logs

- Fix: now properly closes all fds after logging has finished.

- New command: pm2 gc (manually triggers garbage collection for PM2)

- VersioningManagment: exec() timeout configurable via .json

- Fix #1143 :
If we start let's say 4 instances of an app (cluster_mode),
Each app will have a value in process.env.NODE_APP_INSTANCE which will be 0 for the first one,
1, 2 and 3 for the next ones.

- Fix #1154 :
Negative arguments to '-i' are substracted to CPU cores number.
E.g: 'pm2 start app.js -i -3' in a 8 cpus environment will start 5 instances (8 - 3).

## 0.12.10

- Fix : PM2 interactor doesn't send data about dead processes ('_old_') anymore.
- Fix #1137 : Safe params for 'pm2 list' so cli-table won't fail
- Refactored reverse interaction with keymetrics for better stability and more verbosity on Rollback/Pull/Upgrade operations

## 0.12.9

- Fix #1124 : PM2_PROGRAMMATIC flag wasn't handled properly
- Fix #1121 : NODE_PATH before PATH so custom node versions come first
- Fix #1119 : Safe params so cli-table won't fail
- Fix #1099 : Bug when app name starts by digit (e.g '1-myApp')
- Fix #1111 : More verbosity on writeFileSync errors
- New env setting: PM2_KILL_TIMEOUT (ms) : time to wait before a process is considered dead
- New env setting: PM2_CONCURRENT_ACTIONS : use it with care, value bigger than 1 is considered unstable
- Refactored reload/gracefulReload for better stability

## 0.12.8

- Fix : `Channel closed error`
- Fix : `Resource leak error`
- Fix#1091 : when passing a wrong formated number to `-i` infinite loop
- Fix #1068 #1096 : restart fails after reloadLogs()
- New : When PM2 is being killed, all restarts are blocked to avoid conflict
- New : PM2 dumps the process list before exiting if it is killed by signal
- Refactored stop/restart for better stability

## 0.12.7

- pm2 logs : Now shows merged logs
- Fix #929 #1043 : Bug pm2 stop/restart not working properly
- Fix #1039 : Better algorithm for vision recursive parsing to avoid infinite loops
- Automatize #858 #905: Directly init pm2 folder if not present when using it programmatically
- Add Bus system from PM2 programmatic API

## 0.12.6

- Enhancement of startJson command (force_name and additional_env options)
- Fix #990 : pm2 flush while pm2 logs was open bug
- Fix #1002 : pm2 monit bug
- Fix #1024 : enhancement
- Fix #1011 : json-stringify-safe bug
- Fix #1007 ##1028 #1013 #1009 : pm2 desc bug
- Fix : pm2 interact delete when file doesn't exist bug

## 0.12.5

- Windows support

## 0.12.4

- Never start a process that already has a PID [#938]
- 1. Make platform auto detecting. 2. Support darwin startup script. [#936]
- Fix #857 #935, add scriptArgs back [d61d710]
- Fix broken link upstart [f8ff296]
- Fixed: multiple calls to vizion.parse() for the same process [0e798b1]
- fix 2015 test easter egg - Happy New Year! [85d11d5]
- fixes #906 [#911]
- Add back automatic coffee interpreter #488 #901 [e9a69fe]
- Upgrade cli-table, commander, colors, moment dependencies [0cc58ce][a4b7d8d]
- Domain system to patch fix the exception thrown by the cluster module
- Fix #830 #249 #954 when there is no HOME env to default to /etc/.pm2 [17d022c]

## 0.12.3

- fixed critical bug: `process.env` flattens all env-vars [#898]
- npm maintainers format [#894]
- fix `pm2 desc` crash bug [#892]
- fix CLI typo [#888]
- `port` config [#885]

## 0.12.2

- treeKill copyright and update [#848] [#849]
- Allow environment variables per each ecosystem deploy [#847]
- max-memory-restart option [#697] [#141]
- JSON validation (cf ADVANCED_README.md) [#768] [#838]
- CLI/JSON refactoring
- watch fixes
- execute binary softwares
- node_args refactored (ESC support) [#838]
- reload env graceful and peaceful [#838]
- min_uptime added [#838]
- startOrRestart conf.json does update environment variables [#805]
- vizion only refresh ahead and unstaged flags [f1f829c]
- worker restart cluster process if it's equal to 0 && online [c2e3581]
- pm2 pull <name> [commit_id] [c2e3581] [4021902]
- fix reloadLogs for fork mode [c0143cc][197781e]
- waterfall logs stream [#822]
- --log option to have a merged error and out output [#822]
- God core refactors
- test refactoring
- update isBinaryFile [636fd99]
- pid deletion has been resurected [f2ce631]
- worker refactor [29fc72b]
- fix no color [3feead2]
- upgrade chokidar 0.12 with follow symlink [4ac0e74]
- refactor Reload [cf94517][f1eb17]
- avoid truncate with pm2 logs command [26aff8b]
- God print log with timestamp via PM2_LOG_DATE_FORMAT [bf2bf8a][3eaed07]
- better test suit
- new treekill system [11fe5f4]

Big thanks to @Tjatse !

## 0.12.1

- Harden Lock system
- Fix Worker bug / Refactor Worker
- Cleanly close interactor sockets on end
- Add backward compatibility for older PM2 on kill action via system signal SIGQUIT
- once listener for killDaemon

## 0.12.0 - clear water ops

- better ecosystem.json5 file with embedded comments
- startOrRestart conf.json update environment variables #805 #812
- pm2 start my/bin/file work out of the box
- JSON5 support
- PM2_HOME supported - PM2 files paths relocation (logs, pid) via PM2_HOME option
- post_updates commands are searched in process.json/ecosystem.json/package.json
- Worker system to verify up to date repositories
- Rename process running with PM2 <version> - app_name
- Process Lock system
- Inner iteraction with PM2 possible #782
- Better vizion system
- backward / forward / pull command
- Doc moved to doc
- remove uidnumber module
- pre install / post install scripts removed
- Remote Lock System
- More God tests
- GRACEFUL_LISTEN_TIMEOUT constant configurable
- Logs are closed in Fork mode when reloading
- Fix not tty
- Fix cluster structure nullification
- Pre Windows Support
- Send revision process on each process event
- Upgrade Commander (better help display)
- Upgrade chokidar to 0.10.x
- Better interactor
- Better revision parsing
- Configuration file
- Close fd in fork mode while reloading
- Remove --run-as-user option
- Better CLI interface for interactor
- axm:monitor axm:dynamic
- Temporaly merge pm2-interface with pm2
- Cache cpu infos
- Make revision transit in God.bus broadcast
- Ignore useless events in God.bus broadcast

## 0.11.0-1

- Multi user support and privilege containment: UNIX sockets instead of TCP
- Reload refactoring
- Process on uncaughtexcption to flush process list
- pm2 logs display state change of processes

## 0.10.x

- multi host for pm2 deploy
- fork mode by default
- fix watch on clusters
- refactor watch
- env option via programmatic interface
- fix watch system
- correct pm2 describe command
- close file used via pm2 flush
- add startOrReload
- better closing events

## 0.10.0 - PM2 Hellfire release

- PM2 hearth code has been refactored and now it handles extreme scenario without any leak or bug
- PM2 restart <json|id|name|all> refresh current environment variables #528
- PM2 delete all more verbose
- PM2 reset <all|id|name> reset restart numbers
- Auto update script at PM2 installation
- --watch enhanced to avoid zombie processes
- Restart app when reaching a limit of memory by using --max-memory-restart (and max_memory_restart via JSON)(https://github.com/Unitech/pm2#max-memory-restart)
- PM2 respects strong unix standard process management
- Remove timestamps by default with pm2 logs
- Coffeescript not enabled by default anymore (enhance memory usage)
- PM2 Programmatic interface enhanced
- PM2 hearth refactor
- PM2 describe show node-args
- node_args for V8 options is now available via JSON declaration
- Watch system avoid ghost processes
- Memory leak fixes
- Better performance on interface
- Fix tests
- Enable PM2_NODE_OPTIONS and node-args for fork mode
- Dependencies updated
- Faster monitoring system
- AXM actions unification
- Socket errors handled
- Watchdog via Agent - restart automatically PM2 with previous processes in case of crash
- PM2_NODE_OPTIONS deprecation (use --node-args instead)

## 0.9.6 - 0.9.5 - 0.9.4

- Bash test auto exit when failure
- Bump fix log streaming
- Bump fix to display old logs streaming by default
- Bump fix

## 0.9.3

- Critical bug on fork mode fixed (stream close)
- Advanced log display interface pm2-logs #589
- Simple log timestamp via --log-date-format (with momentJS formating) #183
- Possible to pass arguments via scriptArg with programmatic PM2 #591
- Gentoo startup script generation #592
- Fix run-as-user and run-as-group in fork mode #582
- Documentation update

## 0.9.2

- max_restart enabled
- sudo fix for init scripts
- some startup refactoring
- Possibility to specify the configuration folder for PM2 via process.env.PM2_HOME
- Fix date format
- N/A for undefined date
- Evented interactions with PM2, available via pm2-interface
- Deep Interactor refactoring
- Force reload for upstart script

## 0.9.0-0.9.1

- CLI flattening
- require('pm2') possible to interact with
- deployment system
- Remove builtin monitoring feature
- Fix watch on delete #514
- Gracefull reload now rightly handled #502
- Allow path in watch option #501
- Allow management of non-interpreted binaries #499
- Documentation fixes

## 0.8.12-0.8.15

- Version bumping

## 0.8.12

- Fix CWD option #295

## 0.8.10-0.8.11

- Builtin monitoring feature with email (with pm2 subscribe)
- Reload Logs for Fork
- Deletion of possible circular dependencies error
- pm2 updatePM2 command to update in-memory pm2
- notification message if the in-memory pm2 is outdated
- cwd option in json #405 #417 #295
- README updates
- ipc channel for fork mode
- re enable process event loggin for interactor
- avoid possible stream error
- watch ignore option in JSON

## 0.8.5-6

- Update monitoring module

## 0.8.4

- Remove C++ binding for monitoring
- Update axon and axon-rpc

## 0.8.2

- Adds option to switch to a different user/group before starting a managed process #329
- watch doesnt watch node_module folder
- default log files and pid files location can be overrided by PM2_LOG_DIR / PM2_PID_DIR


## 0.8.1

- Readme changes #400 #398
- Fix describe command #403
- reload/gracefulReload throw error if no process has been reloaded #340

## 0.8.0

- More verbosity to pm2.log
- Fast Watch & Reload
- New README.md
- --merge-logs option to merge logs for a group of process
- logs reload with SIGUSR2 or `pm2 reloadLogs`
- return failure code when no process has been reloaded
- Upgrade of outdated packages
- Silent (-s) flag remove all possible pm2 output to CLI
- New display for list, more compact
- `pm2 describe <id>` to get more details about a process
- Fixed 0.10.x issue when stop/kill
- Helper shown when -h
- Linter errors
- Systemd support for Fedora / ArchLinux
- #381 Add support for Amazon Linux startup script
- Fixed rendering
- Interaction possible with VitalSigns.io
- Avoid exception when dump file is not present

## 0.7.8

- List processes with user right `service pm2-init.sh status`

## 0.7.7

- Bug fixes, stability fixes

## 0.7.2

- harmony can be enabled [Enabling harmony](#a66)
- can pass any options to node via PM2_NODE_OPTIONS, configurable via ~/.pm2/custom_options.sh
- pid file written in ~/.pm2/pm2.pid
- startup script support for CentOS
- --no-daemon option (Alex Kocharin)
- json file now can be : started/stoped/restarted/deleted
- coffeescript support for new versions (Hao-kang Den)
- accept JSON via pipe from standard input (Ville Walveranta)
- adjusting logical when process got an uncaughtException (Ethanz)

### Update from 0.x -> 0.7.2

- CentOS crontab option should not be used anymore and use the new init script with `pm2 startup centos`
- If you use the configuration file or the harmonoy option, you should regenerate the init script

## 0.7.1

- Integrates hardened reload, graceful reload and strengthened process management

## 0.7.0

- Reload works at 100%
- Logs are now separated by process id
- Minimal listing with -m option
- pid files are deleted once process exit
- ping method to launch or knwo if pm2 is alive
- more tests
- coffeescript is supported in cluster mode
- clean exit
- clean process stopping
- speed process management enhanced
- async used instead of recuresive loops
- broad test for node 0.11.10 0.11.9 0.11.8 0.11.7 0.11.5 0.10.24 0.10.23 0.10.22 0.10.21 0.10.20 0.10.19 0.10.18 0.10.17 0.10.16 0.10.15 0.10.14 0.10.13 0.10.12 0.10.11 0.8

## 0.6.8

- Homogeneize JSON #186
- Auto intepreter selection (you can do pm2 start app.php)

## 0.5.6

- Coffeescript support
- Updating dependencies - axon - commander
- Log feature enhanced - duplicates removed - name or id can be passed to pm2 logs xxx

## 0.5.5

- Ability to set a name to a launched script + tests
    - with the --name option when launching file
    - with the "name" parameter for JSON files
- Ability to restart a script by name + tests
- Upgrade node-usage to 0.3.8 - fix monitoring feedback for MacOSx
- require.main now require the right file (activate it by modifying MODIFY_REQUIRE in constants.js)
- CentOS startup script with pm2 startup centos
- 0 downtime reload

## 0.5.4

- Remove unused variable in startup script
- Add options min_uptime max_restarts when configuring an app with JSON
- Remove pid file on process exit
- Command stopAll -> stop all | restartAll -> restart all (backward compatible with older versions)

## 0.5.0

- Hardening tests
- Cron mode to restart a script
- Arguments fully supported
- MacOSx monitoring possible
