name 'ai-vehicles'
author 'TGIANN'
version '0.1.3' -- x-release-please-version
license 'GPL-3.0-only'
description 'Owned vehicles: storage, spawning and the qbx_vehicles API'
repository 'https://github.com/aifivem/ai-vehicles'
fx_version 'cerulean'
game 'gta5'
node_version '22'

server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
}
provide 'qbx_vehicles'
