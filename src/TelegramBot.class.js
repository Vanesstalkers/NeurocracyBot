/**
 * @typedef {import('./Base.class.js').constructData} constructData
 */
/**
 * @typedef telegramBotBuildData
 * @property {object} commandList - jsdoc commandList
 * @property {object} adminCommandList - jsdoc adminCommandList
 * @property {handlerList} handlerList - jsdoc handlerList
 */
/**
 * @typedef handlerList
 * @property {function} [error] - jsdoc handlerList error
 * @property {function} [webhook_error] - jsdoc handlerList error
 * @property {function} [polling_error] - jsdoc handlerList error
 */

import { BuildableClass } from "./Base.class.js";
import TelegramApi from "node-telegram-bot-api";
import EventEmitter from "events";

/**
 * Бот
 * @extends BuildableClass
 */
class TelegramBot extends BuildableClass {
  /** @type {TelegramApi} */
  #api;
  // #testApi;
  #message_id = 0;
  /** @param {constructData} data */
  constructor(data) {
    super(data);
    this.#api = new TelegramApi(CONFIG.telegram.token, {
      polling: false,
    });
  }
  /**
   * Асинхронный конструктор класса
   * @param {telegramBotBuildData} data
   */
  static async build(
    { commandList, adminCommandList, handlerList } = {
      commandList: {},
      adminCommandList: {},
      handlerList: {},
    }
  ) {
    const bot = new TelegramBot({ parent: null, createdFromBuilder: true });
    bot.#api.startPolling();
    await bot.#api
      .setMyCommands(
        Object.entries(commandList).map(([command, info]) => {
          return { command, description: info.description };
        })
      )
      .catch((err) => {
        console.error("!!! TelegramAPI setMyCommands error");
        throw err?.message;
      });
    handlerList.error = async function (/** @type {Error} */ err) {
      console.log("!!! TelegramApi error :: ", err?.message);
    };
    handlerList.webhook_error = async function (/** @type {Error} */ err) {
      console.log("!!! TelegramApi webhook_error :: ", err?.message);
    };
    handlerList.polling_error = async function (/** @type {Error} */ err) {
      console.log("!!! TelegramApi polling_error :: ", err?.message);
    };
    //bot.#api = api;
    // bot.#testApi = new EventEmitter();
    bot.commandList = commandList;
    bot.adminCommandList = adminCommandList;
    for (const [handler, action] of Object.entries(handlerList)) {
      bot.setHandler({ handler, action: action.bind(bot) });
    }

    return bot;
  }
  setHandler({ handler, action } = {}) {
    this.#api.on(handler, action);
    // this.#testApi.on(handler, action);
  }
  async toggleHandler({ handler, msg } = {}) {
    return new Promise((resolve, reject) => {
      msg.message_id = this.#message_id++;
      console.log("handler", { message_id: msg.message_id });
      //this.#testApi.emit(handler, msg, resolve);
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
export default TelegramBot;
