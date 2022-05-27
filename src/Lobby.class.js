import User from "./User.class.js";

class Bot {
  lastReplyMsg = { text: 1 };
  constructor() {
    return this;
  }
}

export default class Lobby {
  userList = {};
  fakeChatList = {};

  discussList = {};

  constructor() {}
  async getBot() {
    const bot = new Bot();
    return bot;
  }
  async getUser({ userId, chatId, userData, telegramData, fake }) {
    if (!userId) {
      throw new Error("userId not found");
    } else {
      if (this.userList[userId]) return this.userList[userId];
      if (!chatId) throw new Error("chatId not found");
      const user = new User();
      await user.init({ userId, userData, telegramData });
      this.userList[userId] = user;
      this.userList[userId].currentChat = chatId;
      if (fake) this.fakeChatList[this.userList[userId].currentChat] = true;
      return this.userList[userId];
    }
  }
}
