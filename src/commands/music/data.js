/*
 *   This file is part of Ribbon
 *   Copyright (C) 2017-2018 Favna
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, version 3 of the License
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 *   Additional Terms 7.b and 7.c of GPLv3 apply to this file:
 *       * Requiring preservation of specified reasonable legal notices or
 *         author attributions in that material or in the Appropriate Legal
 *         Notices displayed by works containing it.
 *       * Prohibiting misrepresentation of the origin of that material,
 *         or requiring that modified versions of such material be marked in
 *         reasonable ways as different from the original version.
 */

const ytdl = require('ytdl-core');

global.dispatcher;
const queue = {}; // eslint-disable-line one-var

global.playSong = function (m, s) {
	global.dispatcher = m.guild.voiceConnection.playStream(ytdl(s.url, {'filter': 'audioonly'})); // eslint-disable-line sort-vars
	queue[m.guild.id].playing = true;
	m.say(`Playing: \`${s.title}\` as requested by \`${s.requester}\``);
};

global.endStream = function (m) {
	global.dispatcher.on('end', () => {
		queue[m.guild.id].songs.shift();
		queue[m.guild.id].playing = false;
		global.playSong(m, queue[m.guild.id].songs[0]);
	});
};

global.errStream = function (m) {
	global.dispatcher.on('error', err => m.reply(`⚠️ An error occured in the music dispatcher. You could consider contacting Favna#2846\nThe error is ${err}`));
};

module.exports = {queue};