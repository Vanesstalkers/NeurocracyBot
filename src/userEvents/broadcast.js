import { Event } from "../Base.class.js";

export default class Broadcast extends Event {
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user } = {}) {
    return new Broadcast({ parent: user, createdFromBuilder: true });
  }
  async start() {
    await BOT.sendMessage(this.startMsgWrapper(), true);
  }
  startMsgWrapper() {
    const user = this.getParent();
    let text = "привет. вбей текст.";
    let inlineKeyboard = [];
    if (this.broadcastText) {
      text += `\n\n<b>Текст для отправки: </b><i>${this.broadcastText}</i>`;
      inlineKeyboard = [
        [
          //{ text: "Изменить", callback_data: "edit" },
          { text: "Отправить", callback_data: "send" },
        ],
      ];
    }
    this.onTextReceivedHandler = this.saveText;
    return user.simpleMsgWrapper({
      msgId: user.lastMsg?.id,
      text,
      inlineKeyboard,
    });
  }
  async saveText({ text } = {}) {
    this.broadcastText = text;
    await BOT.editMessageText(this.startMsgWrapper());
  }
  async edit() {
    // не акутально, так как this.onTextReceivedHandler не сбрасывается
    this.onTextReceivedHandler = this.saveText;
  }
  async send() {
    const queryData = await DB.query(
      `
                SELECT u.id
                FROM users u
            `,
      []
    ).catch(async (err) => {
      this.getParent().sendSystemErrorMsg({ err });
      throw new Error(err);
    });
    console.log(
      "queryData.rows=",
      queryData.rows,
      "broadcastText=",
      this.broadcastText
    );
    //queryData.rows = [{id:267280060}];
    for (const row of queryData.rows) {
      await BOT.sendMessage({
        chatId: row.id,
        text: this.broadcastText,
      });
    }
  }
}
