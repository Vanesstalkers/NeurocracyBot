
import TelegramApi from 'node-telegram-bot-api';
import EventEmitter from 'events';

export default class {
  #api;
  #testApi;
  #message_id = 0;
  constructor({ commands }) {
      this.#testApi = new EventEmitter();
      this.#api = new TelegramApi(process.CONFIG.telegram.token, { polling: true });
      this.#api.setMyCommands(commands);
  }
  setHandler({ handler, action }) {
      this.#api.on(handler, action);
      this.#testApi.on(handler, action);
  }
  async toggleHandler({ handler, msg }) {
      return new Promise((resolve, reject)=>{
          msg.message_id = this.#message_id++;
          console.log('handler', {message_id: msg.message_id});
          this.#testApi.emit(handler, msg, resolve);
      });
  }
  async sendMessage({ chatId, text, keyboard, inlineKeyboard, parseMode, replyId }) {
      try {
          const options = { parse_mode: parseMode || 'HTML' };
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

          if(replyId){
              options.reply_to_message_id = replyId;
              options.allow_sending_without_reply = true;
          }

          if(process.LOBBY.fakeChatList[chatId]){
              console.log('sendMessage', {chatId, text, options});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.sendMessage(chatId, text, options);
          }
      } catch (err) { console.log(err.toString()) }
  }
  async editMessageText({ chatId, msgId, text, inlineKeyboard }) {
      try {
          const options = { parse_mode: 'HTML' };
          options.chat_id = chatId;
          options.message_id = msgId;
          if (inlineKeyboard) {
              options.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard });
          }
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('editMessageText', {text, options});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.editMessageText(text, options);
          }
      } catch (err) { console.log(err.toString()) }
  }
  async deleteMessage({ chatId, msgId }) {
      try {
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('deleteMessage', {chatId, msgId});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.deleteMessage(chatId, msgId);
          }
      } catch (err) { console.log(err.toString()) }
  }
  async pinChatMessage({ chatId, msgId }) {
      try {
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('pinChatMessage', {chatId, msgId});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.pinChatMessage(chatId, msgId);
          }
      } catch (err) { console.log(err.toString()) }
  }
  async answerInlineQuery({ queryId, results }) {
      try {
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('answerInlineQuery', {queryId, results});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.answerInlineQuery(queryId, JSON.stringify(results));
          }
      } catch (err) { console.log(err.toString()) }
  }

  async sendLocation({ chatId, latitude, longitude }) {
      try {
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('sendLocation', {chatId, latitude, longitude});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.sendLocation(chatId, latitude, longitude);
          }
      } catch (err) { console.log(err.toString()) }
  }
  async sendVenue({ chatId, latitude, longitude, title, address }) {
      try {
          if(process.LOBBY.fakeChatList[chatId]){
              console.log('sendVenue', {chatId, latitude, longitude});
              return {message_id: this.#message_id};
          }else{
              return await this.#api.sendVenue(chatId, latitude, longitude, title, address );
          }
      } catch (err) { console.log(err.toString()) }
  }
}