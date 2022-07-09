import vm from "vm";
import * as errors from "../node_modules/node-telegram-bot-api/src/errors.js";
import * as debug from "debug";
import * as request from "request-promise";
const testLibs = { errors, debug, request };

import { BuildableClass } from "./Base.class.js";
import _TelegramApi from "node-telegram-bot-api";
const TelegramApi = global.test
  ? new Proxy(_TelegramApi, {
      construct(target, args) {
        return new Proxy(new target(...args), {
          get(target, name) {
            switch (name) {
              case "startPolling":
                return () => {};
              // case 'setMyCommands': return async ()=>true;
              case "_request":
                return async function (...arg) {
                  const contextObject = {
                    target,
                    arg,
                    result: undefined,
                    request: async () => ({
                      body: JSON.stringify({
                        ok: false,
                        result: false,
                        error_code: 666,
                        description: "Мы все умрем",
                      }),
                    }),
                  };
                  const contextifiedObject = vm.createContext(contextObject);
                  const module = new vm.SourceTextModule(
                    `
                import errors from 'errors';
                import debugLib from 'debug';
                const debug = debugLib('node-telegram-bot-api');
                //import request from 'request';
                result = (function ${target._request.toString()}).call(target, ...arg)
              `,
                    { context: contextifiedObject }
                  );
                  await module.link(async function linker(
                    specifier,
                    referencingModule
                  ) {
                    return new vm.SourceTextModule(
                      Object.keys(testLibs[specifier])
                        .map(
                          (x) =>
                            `export ${
                              x !== "default" ? `const ${x} = ` : `${x}`
                            } import.meta.mod.${x};`
                        )
                        .join("\n"),
                      {
                        context: contextifiedObject,
                        initializeImportMeta(meta) {
                          meta.mod = testLibs[specifier];
                        },
                      }
                    );
                  });
                  await module.evaluate();
                  return contextObject.result;
                };
              default:
                return target[name];
            }
          },
        });
      },
    })
  : _TelegramApi;
import EventEmitter from "events";

export default class TelegramBot extends BuildableClass {
  #api;
  #testApi;
  #message_id = 0;
  constructor({ api, commandList, adminCommandList, handlerList } = {}) {
    super(...arguments);
    this.#api = api;
    this.#testApi = new EventEmitter();
    this.commandList = commandList;
    this.adminCommandList = adminCommandList;
    for (const [handler, action] of Object.entries(handlerList)) {
      this.setHandler({ handler, action: action.bind(this) });
    }
  }
  static async build({ commandList, adminCommandList, handlerList } = {}) {
    const api = new TelegramApi(CONFIG.telegram.token, {
      polling: false,
    });
    api.startPolling();
    await api
      .setMyCommands(
        Object.entries(commandList).map(([command, info]) => {
          return { command, description: info.description };
        })
      )
      .catch((err) => {
        console.error("!!! TelegramAPI setMyCommands error");
        throw err?.message;
      });
    handlerList.error = async function (err) {
      console.log("!!! TelegramApi error :: ", err?.message);
    };
    handlerList.webhook_error = async function (err) {
      console.log("!!! TelegramApi webhook_error :: ", err?.message);
    };
    handlerList.polling_error = async function (err) {
      console.log("!!! TelegramApi polling_error :: ", err?.message);
    };
    return new TelegramBot({
      api,
      commandList,
      adminCommandList,
      handlerList,
      createdFromBuilder: true,
    });
  }
  setHandler({ handler, action } = {}) {
    this.#api.on(handler, action);
    this.#testApi.on(handler, action);
  }
  async toggleHandler({ handler, msg } = {}) {
    return new Promise((resolve, reject) => {
      msg.message_id = this.#message_id++;
      console.log("handler", { message_id: msg.message_id });
      this.#testApi.emit(handler, msg, resolve);
    });
  }
  errorHandler({ userId, chatId, method }) {
    return async (err) => {
      console.error(`!!! TelegramAPI ${method} error`);
      switch (err.message) {
        case "ETELEGRAM: 400 Bad Request: chat not found":
          break;
        case "ETELEGRAM: 403 Forbidden: bot was blocked by the user":
          console.log({ userId, chatId });
          break;
        default:
          const user = await LOBBY.getUser({ userId, chatId });
          await user.sendSystemErrorMsg({ err });
          break;
      }
      new errorCatcher(err, true);
      return false;
    };
  }
  async sendMessage(
    {
      userId,
      chatId,
      text,
      keyboard,
      inlineKeyboard,
      entities,
      parseMode,
      replyId,
    } = {},
    saveMsgConfig = false
  ) {
    const options = { parse_mode: parseMode || "HTML" };
    const replyMarkup = {};
    if (keyboard) {
      replyMarkup.keyboard = keyboard;
      replyMarkup.resize_keyboard = true;
    }
    if (inlineKeyboard) {
      replyMarkup.inline_keyboard = inlineKeyboard;
    }
    if (Object.keys(replyMarkup).length) {
      options.reply_markup = JSON.stringify(replyMarkup);
    }
    if (Object.keys(entities || {}).length) {
      options.entities = JSON.stringify(entities);
      delete options.parse_mode;
    }

    if (replyId) {
      options.reply_to_message_id = replyId;
      options.allow_sending_without_reply = true;
    }

    let msg;
    if (LOBBY.fakeChatList[chatId]) {
      console.log("sendMessage", { chatId, text, options });
      msg = { message_id: this.#message_id };
    } else {
      msg = await this.#api
        .sendMessage(chatId, text, options)
        .catch(this.errorHandler({ userId, chatId, method: "sendMessage" }));
    }
    if (saveMsgConfig) {
      const user = await LOBBY.getUser({ userId, chatId });
      user.setLastMsg({ id: msg.message_id, text, config: saveMsgConfig });
    }
    return msg;
  }
  async editMessageText({ userId, chatId, msgId, text, inlineKeyboard } = {}) {
    const options = { parse_mode: "HTML" };
    options.chat_id = chatId;
    options.message_id = msgId;
    if (inlineKeyboard) {
      options.reply_markup = JSON.stringify({
        inline_keyboard: inlineKeyboard,
      });
    }
    if (LOBBY.fakeChatList[chatId]) {
      console.log("editMessageText", { text, options });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .editMessageText(text, options)
        .catch(
          this.errorHandler({ userId, chatId, method: "editMessageText" })
        );
    }
  }
  async deleteMessage({ userId, chatId, msgId } = {}) {
    if (LOBBY.fakeChatList[chatId]) {
      console.log("deleteMessage", { chatId, msgId });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .deleteMessage(chatId, msgId)
        .catch(this.errorHandler({ userId, chatId, method: "deleteMessage" }));
    }
  }
  async pinChatMessage({ userId, chatId, msgId, disableNotify } = {}) {
    if (LOBBY.fakeChatList[chatId]) {
      console.log("pinChatMessage", { chatId, msgId });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .pinChatMessage(chatId, msgId, { disable_notification: disableNotify })
        .catch(this.errorHandler({ userId, chatId, method: "pinChatMessage" }));
    }
  }
  async answerInlineQuery({ userId, chatId, queryId, results } = {}) {
    if (LOBBY.fakeChatList[chatId]) {
      console.log("answerInlineQuery", { queryId, results });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .answerInlineQuery(queryId, JSON.stringify(results))
        .catch(
          this.errorHandler({ userId, chatId, method: "answerInlineQuery" })
        );
    }
  }

  async sendLocation({ userId, chatId, latitude, longitude } = {}) {
    if (LOBBY.fakeChatList[chatId]) {
      console.log("sendLocation", { chatId, latitude, longitude });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .sendLocation(chatId, latitude, longitude)
        .catch(this.errorHandler({ userId, chatId, method: "sendLocation" }));
    }
  }
  async sendVenue({
    userId,
    chatId,
    latitude,
    longitude,
    title,
    address,
  } = {}) {
    if (LOBBY.fakeChatList[chatId]) {
      console.log("sendVenue", { chatId, latitude, longitude });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .sendVenue(chatId, latitude, longitude, title, address)
        .catch(this.errorHandler({ userId, chatId, method: "sendVenue" }));
    }
  }
}
