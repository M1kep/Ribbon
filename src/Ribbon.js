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

/* eslint-disable sort-vars */
const Database = require('better-sqlite3'),
  path = require('path'),
  request = require('snekfetch'),
  {Client, FriendlyError, SyncSQLiteProvider} = require('discord.js-commando'),
  {MessageEmbed} = require('discord.js'),
  {oneLine, stripIndents} = require('common-tags'),
  {badwords, duptext, caps, emojis, mentions, links, invites, slowmode} = require(path.join(__dirname, 'components/automod.js')),
  {checkReminders, forceStopTyping, joinmessage, leavemessage, lotto, timermessages} = require(path.join(__dirname, 'components/events.js'));
/* eslint-enable sort-vars */

class Ribbon {
  constructor (token) {
    this.token = token;
    this.client = new Client({
      commandPrefix: '!',
      owner: '112001393140723712',
      selfbot: false,
      unknownCommandResponse: false,
      presence: {
        status: 'online',
        activity: {
          application: '376520643862331396',
          name: '@Ribbon help',
          type: 'WATCHING',
          details: 'Made by Favna',
          state: 'https://favna.xyz/ribbon',
          assets: {
            largeImage: '385133227997921280',
            smallImage: '385133144245927946',
            largeText: 'Invite me to your server!',
            smallText: 'https://favna.xyz/redirect/ribbon'
          }
        }
      }
    });
  }

  onCmdBlock () {
    return (msg, reason) => {
      console.log(oneLine`
		Command ${msg.command ? `${msg.command.groupID}:${msg.command.memberName}` : ''}
		blocked; ${reason}`);
    };
  }

  onCmdErr () {
    return (cmd, err) => {
      if (err instanceof FriendlyError) {
        return;
      }
      console.error(`Error in command ${cmd.groupID}:${cmd.memberName}`, err);
    };
  }

  onCommandPrefixChange () {
    return (guild, prefix) => {
      console.log(oneLine` 
			Prefix ${prefix === '' ? 'removed' : `changed to ${prefix || 'the default'}`}
			${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
		`);
    };
  }

  onCmdStatusChange () {
    return (guild, command, enabled) => {
      console.log(oneLine`
            Command ${command.groupID}:${command.memberName}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    };
  }

  onDisconnect () {
    return () => {
      console.warn('Disconnected!');
    };
  }

  onError () {
    return (e) => {
      console.error(e);
    };
  }

  onGroupStatusChange () {
    return (guild, group, enabled) => {
      console.log(oneLine`
            Group ${group.id}
            ${enabled ? 'enabled' : 'disabled'}
            ${guild ? `in guild ${guild.name} (${guild.id})` : 'globally'}.
        `);
    };
  }

  onGuildMemberAdd () {
    return (member) => {
      if (member.guild.settings.get('memberlogs', true)) {
        const memberJoinLogEmbed = new MessageEmbed(),
          memberLogs = member.guild.settings.get('memberlogchannel',
            member.guild.channels.find(c => c.name === 'member-logs') ? member.guild.channels.find(c => c.name === 'member-logs').id : null);

        memberJoinLogEmbed.setAuthor(`${member.user.tag} (${member.id})`, member.user.displayAvatarURL({format: 'png'}))
          .setFooter('User joined')
          .setTimestamp()
          .setColor('#80F31F');

        if (member.guild.settings.get('defaultRole')) {
          member.roles.add(member.guild.settings.get('defaultRole'));
          memberJoinLogEmbed.setDescription(`Automatically assigned the role ${member.guild.roles.get(member.guild.settings.get('defaultRole')).name} to this member`);
        }

        if (memberLogs && member.guild.channels.get(memberLogs).permissionsFor(this.client.user)
          .has('SEND_MESSAGES')) {
          member.guild.channels.get(memberLogs).send('', {embed: memberJoinLogEmbed});
        }
      }

      if (member.guild.settings.get('joinmsgs', false) && member.guild.settings.get('joinmsgchannel', null)) {
        joinmessage(member);
      }
    };
  }

  onGuildMemberRemove () {
    return (member) => {
      if (member.guild.settings.get('memberlogs', true)) {
        const memberLeaveLogEmbed = new MessageEmbed(),
          memberLogs = member.guild.settings.get('memberlogchannel',
            member.guild.channels.find(c => c.name === 'member-logs') ? member.guild.channels.find(c => c.name === 'member-logs').id : null);

        memberLeaveLogEmbed.setAuthor(`${member.user.tag} (${member.id})`, member.user.displayAvatarURL({format: 'png'}))
          .setFooter('User left')
          .setTimestamp()
          .setColor('#F4BF42');

        if (memberLogs && member.guild.channels.get(memberLogs).permissionsFor(this.client.user)
          .has('SEND_MESSAGES')) {
          member.guild.channels.get(memberLogs).send('', {embed: memberLeaveLogEmbed});
        }
      }

      try {
        const conn = new Database(path.join(__dirname, 'data/databases/casino.sqlite3')),
          query = conn.prepare(`SELECT * FROM "${member.guild.id}" WHERE userID = ?`).get(member.id);

        if (query) {
          conn.prepare(`DELETE FROM "${member.guild.id}" WHERE userID = ?`).run(member.id);
        }
      } catch (err) {
        null;
      }

      if (member.guild.settings.get('leavemsgs', false) && member.guild.settings.get('leavemsgchannel', null)) {
        leavemessage(member);
      }
    };
  }

  onMessage () {
    /* eslint-disable curly */
    return (msg) => {
      if (msg.guild && msg.deletable && msg.guild.settings.get('automod', false)) {
        if (msg.guild.settings.get('caps', false).enabled) {
          const opts = msg.guild.settings.get('caps');

          if (caps(msg, opts.threshold, opts.minlength, this.client)) msg.delete();
        }
        if (msg.guild.settings.get('duptext', false).enabled) {
          const opts = msg.guild.settings.get('duptext');

          if (duptext(msg, opts.within, opts.equals, opts.distance, this.client)) msg.delete();
        }
        if (msg.guild.settings.get('emojis', false).enabled) {
          const opts = msg.guild.settings.get('emojis');

          if (emojis(msg, opts.threshold, opts.minlength, this.client)) msg.delete();
        }
        if (msg.guild.settings.get('badwords', false).enabled && badwords(msg, msg.guild.settings.get('badwords').words, this.client)) msg.delete();
        if (msg.guild.settings.get('invites', false) && invites(msg, this.client)) msg.delete();
        if (msg.guild.settings.get('links', false) && links(msg, this.client)) msg.delete();
        if (msg.guild.settings.get('mentions', false).enabled && mentions(msg, msg.guild.settings.get('mentions').threshold, this.client)) msg.delete();
        if (msg.guild.settings.get('slowmode', false).enabled && slowmode(msg, msg.guild.settings.get('slowmode').within, this.client)) msg.delete();
      }
    };
    /* eslint-enable curly */
  }

  onPresenceUpdate () {
    return async (oldMember, newMember) => {
      if (newMember.guild.settings.get('twitchmonitors', []).includes(newMember.id)) {
        if (newMember.guild.settings.get('twitchnotifiers', false)) {
          const curDisplayName = newMember.displayName,
            curGuild = newMember.guild,
            curUser = newMember.user;

          let newActivity = newMember.presence.activity,
            oldActivity = oldMember.presence.activity;

          if (!oldActivity) {
            oldActivity = {url: 'placeholder'};
          }
          if (!newActivity) {
            newActivity = {url: 'placeholder'};
          }
          if (!(/(twitch)/i).test(oldActivity.url) && (/(twitch)/i).test(newActivity.url)) {

            /* eslint-disable sort-vars*/
            const userData = await request.get('https://api.twitch.tv/kraken/users')
                .set('Accept', 'application/vnd.twitchtv.v5+json')
                .set('Client-ID', process.env.twitchclientid)
                .query('login', newActivity.url.split('/')[3]),
              streamData = await request.get('https://api.twitch.tv/kraken/streams')
                .set('Accept', 'application/vnd.twitchtv.v5+json')
                .set('Client-ID', process.env.twitchclientid)
                .query('channel', userData.body.users[0]._id),
              twitchChannel = curGuild.settings.get('twitchchannel', null),
              twitchEmbed = new MessageEmbed();
            /* eslint-enable sort-vars*/

            twitchEmbed
              .setThumbnail(curUser.displayAvatarURL())
              .setURL(newActivity.url)
              .setColor('#6441A4')
              .setTitle(`${curDisplayName} just went live!`)
              .setDescription(stripIndents`streaming \`${newActivity.details}\`!\n\n**Title:**\n${newActivity.name}`);

            if (userData.ok && userData.body._total > 0 && userData.body.users[0]) {
              twitchEmbed
                .setThumbnail(userData.body.users[0].logo)
                .setTitle(`${userData.body.users[0].display_name} just went live!`)
                .setDescription(stripIndents`${userData.body.users[0].display_name} just started ${twitchEmbed.description}`);
            }

            if (streamData.ok && streamData.body._total > 0 && streamData.body.streams[0]) {
              twitchEmbed
                .setFooter('Stream started')
                .setTimestamp(streamData.body.streams[0].created_at);
            }
            if (twitchChannel) {
              curGuild.channels.get(twitchChannel).send('', {embed: twitchEmbed});
            }
          }
        }
      }
    };
  }

  onReady () {
    return () => {
      console.log(`Client ready; logged in as ${this.client.user.username}#${this.client.user.discriminator} (${this.client.user.id})`);
      const bot = this.client;

      setInterval(() => {
        forceStopTyping(bot);
        timermessages(bot);
      }, 180000);

      setInterval(() => {
        checkReminders(bot);
      }, 300000);

      setInterval(() => {
        lotto(bot);
      }, 86400000);
    };
  }

  onReconnect () {
    return () => {
      console.warn('Reconnecting...');
    };
  }

  onUnknownCommand () {
    return (msg) => {
      if (this.client.provider.get(msg.guild, 'unknownmessages', true)) {
        return msg.reply(stripIndents`${oneLine`That is not a registered command.
				Use \`${msg.guild ? msg.guild.commandPrefix : this.client.commandPrefix}help\`
				or @Ribbon#2325 help to view the list of all commands.`}
				${oneLine`Server staff (those who can manage other's messages) can disable these replies by using
				\`${msg.guild ? msg.guild.commandPrefix : this.client.commandPrefix}unknownmessages disable\``}`);
      }

      return null;
    };
  }

  init () {
    this.client
      .on('commandBlocked', this.onCmdBlock())
      .on('commandError', this.onCmdErr())
      .on('commandPrefixChange', this.onCommandPrefixChange())
      .on('commandStatusChange', this.onCmdStatusChange())
      .on('debug', console.log)
      .on('disconnect', this.onDisconnect())
      .on('error', this.onError())
      .on('groupStatusChange', this.onGroupStatusChange())
      .on('guildMemberAdd', this.onGuildMemberAdd())
      .on('guildMemberRemove', this.onGuildMemberRemove())
      .on('message', this.onMessage())
      .on('presenceUpdate', this.onPresenceUpdate())
      .on('ready', this.onReady())
      .on('reconnecting', this.onReconnect())
      .on('unknownCommand', this.onUnknownCommand())
      .on('warn', console.warn);

    const db = new Database(path.join(__dirname, 'data/databases/settings.sqlite3'));

    this.client.setProvider(
      new SyncSQLiteProvider(db)
    );

    this.client.registry
      .registerGroups([
        ['games', 'Games - Play some games'],
        ['casino', 'Casino - Gain and gamble points'],
        ['info', 'Info - Discord info at your fingertips'],
        ['music', 'Music - Let the DJ out'],
        ['searches', 'Searches - Browse the web and find results'],
        ['leaderboards', 'Leaderboards - View leaderboards from various games'],
        ['pokemon', 'Pokemon - Let Dexter answer your questions'],
        ['extra', 'Extra - Extra! Extra! Read All About It! Only Two Cents!'],
        ['moderation', 'Moderation - Moderate with no effort'],
        ['automod', 'Automod - Let the bot moderate the chat for you'],
        ['streamwatch', 'Streamwatch - Spy on members and get notified when they go live'],
        ['custom', 'Custom - Server specific commands'],
        ['nsfw', 'NSFW - For all you dirty minds ( ͡° ͜ʖ ͡°)'],
        ['owner', 'Owner - Exclusive to the bot owner(s)']
      ])
      .registerDefaultGroups()
      .registerDefaultTypes()
      .registerDefaultCommands({
        help: true,
        prefix: true,
        ping: true,
        eval_: true,
        commandState: true
      })
      .registerCommandsIn(path.join(__dirname, 'commands'));

    return this.client.login(this.token);
  }
}

module.exports = Ribbon;