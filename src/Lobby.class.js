import { BuildableClass, Bot } from "./Base.class.js";
import telegramBot from "./TelegramBot.class.js";
import User from "./User.class.js";
import botCommandsLST from "./lst/botCommands.js";

export function toCBD() {
  return { callback_data: [...arguments].join("__") };
}
export function fromCBD(callback_data) {
  return callback_data.split("__");
}

export default class Lobby extends BuildableClass {
  userList = {};
  fakeChatList = {};
  discussList = {};
  constructor() {
    super(...arguments);
  }
  static async build() {
    globalThis.BOT = await telegramBot.build({
      commandList: Object.fromEntries(
        Object.entries(botCommandsLST).filter(
          ([key, command]) => !command.admin
        )
      ),
      adminCommandList: Object.fromEntries(
        Object.entries(botCommandsLST).filter(([key, command]) => command.admin)
      ),
      handlerList: {
        message: async function (msg, callback) {
          try {
            //console.log("message", msg);

            const userId = msg.from.id;
            const chatId = msg.chat.id;
            const msgId = msg.message_id;

            // пока что функционал обработки событий от ботов не нужен
            // + после pinChatMessage прилетает сообщение от бота, которое ломает getUser
            if (msg.from.is_bot) return;

            const user = await LOBBY.getUser({
              userId,
              chatId,
              telegramData: msg.from,
            });
            if (!user) return;

            const text = msg.text;
            if (this.adminCommandList[text]) {
              await this.adminCommandList[text].action.call(user, {
                msgId,
                text,
              });
              return;
            }

            if (!msg.entities) {
              const menuHandler = user.getMenuHandler(text);
              if (
                menuHandler === undefined &&
                user.currentAction?.onTextReceivedHandler
              ) {
                await user.currentAction?.onTextReceivedHandler({ text });
                return;
              }
              if (await user.handleMenuAction(text)) {
                return;
              } else {
              }
            } else {
              for (let i = 0; i < msg.entities.length; i++) {
                const entity = msg.entities[i];
                const command = text.substring(
                  entity.offset,
                  entity.offset + entity.length
                );
                if (this.commandList[command]) {
                  await this.commandList[command].action.call(user, {
                    msgId,
                    text,
                  });
                }
              }
            }
          } catch (err) {
            new errorCatcher(err);
          }
          if (typeof callback === "function") callback(); // для testApi
        },
        callback_query: async function (msg, callback) {
          try {
            //console.log("callback_query", msg);

            const userId = msg.from.id;
            const chatId = msg.message.chat.id;
            const msgId = msg.message.message_id;

            // пока что функционал обработки событий от ботов не нужен
            if (msg.from.is_bot) return;

            const user = await LOBBY.getUser({ userId, chatId });

            const action = fromCBD(msg.data);
            const actionFunc =
              user.currentAction?.[action[0]] || user[action[0]];

            if (actionFunc) {
              // if (user.currentAction?.[action[0]] && !action.includes("forceActionCall")) {
              if (user.currentAction?.[action[0]]) {
                if (await user.checkLastMsg({ msgId })) {
                  await actionFunc.call(user.currentAction, {
                    msgId,
                    data: action.slice(1),
                  });
                }
              } else {
                await actionFunc.call(user, { msgId, data: action.slice(1) });
              }
            } else {
              user.sendSystemErrorMsg({
                err: new Error(`action "${action[0]}" not found`),
              });
              throw new Error(`action "${action[0]}" not found`);
            }
          } catch (err) {
            new errorCatcher(err);
          }
          if (typeof callback === "function") callback(); // для testApi
        },
      },
    });
    return new Lobby({ createdFromBuilder: true });
  }
  // async getBot() {
  //   const bot = await Bot.build();
  //   return bot;
  // }
  async getUser({ userId, chatId, telegramData, fake }) {
    if (!userId) {
      throw new Error("userId not found");
    } else {
      if (this.userList[userId]) return this.userList[userId];
      if (!chatId) throw new Error("chatId not found");
      const user = await User.build({ userId, chatId, telegramData });
      this.userList[userId] = user;
      this.userList[userId].currentChat = chatId;
      if (fake) this.fakeChatList[this.userList[userId].currentChat] = true;
      return this.userList[userId];
    }
  }
}
