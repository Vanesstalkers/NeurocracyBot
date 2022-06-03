"use strict";

import config from "./config.js";
import pg from "pg";

import telegramBot from "./src/TelegramBot.class.js";
import Lobby from "./src/Lobby.class.js";

console.error = (...arg) =>
  console.log(
    ["\x1b[31m"]
      .concat(...arg)
      .concat(["\x1b[30m"])
      .join(" ")
  );
``;
export class errorCatcher {
  constructor(err) {
    console.error(err?.message);
    console.log(err);
  }
}

try {
  process.CONFIG = config;
  process.DB = new pg.Pool(config.postgres);
  process.BOT = new telegramBot();
  await process.BOT.setCommands([
    { command: "/start", description: "Стартовое сообщение" },
  ]);

  process.LST = {};
  process.CONSTANTS = {};
  process.BOT_MENU = {};
  process.BOT_COMMANDS = {
    "/start": async function (argList) {
      await this.startMsg(argList);
    },
  };

  process.LOBBY = new Lobby();

  process.BOT.setHandler({
    handler: "message",
    action: async function (msg) {
      try {
        //console.log("message", msg);

        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const msgId = msg.message_id;

        // пока что функционал обработки событий от ботов не нужен
        // + после pinChatMessage прилетает сообщение от бота, которое ломает getUser
        if (msg.from.is_bot) return;

        const user = await process.LOBBY.getUser({ userId, chatId });
        if (!user) return;

        const text = msg.text;

        if (user.currentAction?.onTextReceivedHandler) {
          user.currentAction?.onTextReceivedHandler({ text });
          return;
        }

        if (!msg.entities) {
          const menuItem = process.BOT_MENU[text];
          if (menuItem) {
            if (typeof menuItem.action === "function") {
              await menuItem.action.call({ user, msg });
            }
          } else {
          }
        } else {
          for (let i = 0; i < msg.entities.length; i++) {
            const entity = msg.entities[i];
            const command = text.substring(
              entity.offset,
              entity.offset + entity.length
            );
            if (process.BOT_COMMANDS[command]) {
              await process.BOT_COMMANDS[command].call(user, { msgId, text });
            }
          }
        }
      } catch (err) {
        new errorCatcher(err);
      }
    },
  });

  process.BOT.setHandler({
    handler: "callback_query",
    action: async (msg) => {
      try {
        //console.log("callback_query", msg);

        const userId = msg.from.id;
        const chatId = msg.message.chat.id;
        const msgId = msg.message.message_id;

        // пока что функционал обработки событий от ботов не нужен
        if (msg.from.is_bot) return;

        const user = await process.LOBBY.getUser({ userId, chatId });

        const action = msg.data.split("__");
        const actionFunc = user[action[0]];

        if (actionFunc) {
          await actionFunc.call(user, { msgId, data: action });
        } else {
          user.sendSystemErrorMsg({
            err: new Error(`action "${action[0]}" not found`),
          });
          //throw new Error(`action "${action[0]}" not found`);
        }
      } catch (err) {
        new errorCatcher(err);
      }
    },
  });
} catch (err) {
  switch (err.message) {
    default:
      new errorCatcher(err);
      break;
  }
}
