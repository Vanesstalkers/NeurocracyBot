import TelegramApi from "node-telegram-bot-api";
import EventEmitter from "events";

export default class {
  #api;
  #testApi;
  #message_id = 0;
  constructor() {
    this.#testApi = new EventEmitter();
    this.#api = new TelegramApi(process.CONFIG.telegram.token, {
      polling: false,
    });
    this.setHandler({
      handler: "error",
      action: async function (err) {
        console.log("!!! TelegramApi error :: ", err?.message);
      },
    });
    this.setHandler({
      handler: "webhook_error",
      action: async function (err) {
        console.log("!!! TelegramApi webhook_error :: ", err?.message);
      },
    });
    this.setHandler({
      handler: "polling_error",
      action: async function (err) {
        console.log("!!! TelegramApi polling_error :: ", err?.message);
      },
    });
    this.#api.startPolling();
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
  async setCommands(commandList) {
    await this.#api.setMyCommands(commandList).catch((err) => {
      console.error("!!! TelegramAPI setMyCommands error");
      throw err?.message;
    });
  }
  async sendMessage({
    chatId,
    text,
    keyboard,
    inlineKeyboard,
    entities,
    parseMode,
    replyId,
  } = {}) {
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
    if (Object.keys(entities||{}).length) {
      options.entities = JSON.stringify(entities);
      delete options.parse_mode;
    }

    if (replyId) {
      options.reply_to_message_id = replyId;
      options.allow_sending_without_reply = true;
    }

    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("sendMessage", { chatId, text, options });
      return { message_id: this.#message_id };
    } else {
      return await this.#api.sendMessage(chatId, text, options).catch((err) => {
        console.error("!!! TelegramAPI sendMessage error");
        throw err?.message;
      });
    }
  }
  async editMessageText({ chatId, msgId, text, inlineKeyboard } = {}) {
    const options = { parse_mode: "HTML" };
    options.chat_id = chatId;
    options.message_id = msgId;
    if (inlineKeyboard) {
      options.reply_markup = JSON.stringify({
        inline_keyboard: inlineKeyboard,
      });
    }
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("editMessageText", { text, options });
      return { message_id: this.#message_id };
    } else {
      return await this.#api.editMessageText(text, options).catch((err) => {
        console.error("!!! TelegramAPI editMessageText error");
        throw err?.message;
      });
    }
  }
  async deleteMessage({ chatId, msgId } = {}) {
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("deleteMessage", { chatId, msgId });
      return { message_id: this.#message_id };
    } else {
      return await this.#api.deleteMessage(chatId, msgId).catch((err) => {
        console.error("!!! TelegramAPI deleteMessage error");
        throw err?.message;
      });
    }
  }
  async pinChatMessage({ chatId, msgId } = {}) {
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("pinChatMessage", { chatId, msgId });
      return { message_id: this.#message_id };
    } else {
      return await this.#api.pinChatMessage(chatId, msgId).catch((err) => {
        console.error("!!! TelegramAPI pinChatMessage error");
        throw err?.message;
      });
    }
  }
  async answerInlineQuery({ queryId, results } = {}) {
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("answerInlineQuery", { queryId, results });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .answerInlineQuery(queryId, JSON.stringify(results))
        .catch((err) => {
          console.error("!!! TelegramAPI answerInlineQuery error");
          throw err?.message;
        });
    }
  }

  async sendLocation({ chatId, latitude, longitude } = {}) {
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("sendLocation", { chatId, latitude, longitude });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .sendLocation(chatId, latitude, longitude)
        .catch((err) => {
          console.error("!!! TelegramAPI sendLocation error");
          throw err?.message;
        });
    }
  }
  async sendVenue({ chatId, latitude, longitude, title, address } = {}) {
    if (process.LOBBY.fakeChatList[chatId]) {
      console.log("sendVenue", { chatId, latitude, longitude });
      return { message_id: this.#message_id };
    } else {
      return await this.#api
        .sendVenue(chatId, latitude, longitude, title, address)
        .catch((err) => {
          console.error("!!! TelegramAPI sendVenue error");
          throw err?.message;
        });
    }
  }
}
