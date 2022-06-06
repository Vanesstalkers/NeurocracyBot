import { BuildableClass } from "./Base.class.js";

export default class User extends BuildableClass {
  id;
  #textHandlerList = {};
  #menuReady = false;
  constructor(userData = {}) {
    super(...arguments);
    this.id = userData.id;
  }
  static async build({ userId, userData = {}, telegramData = {} } = {}) {
    const queryData = await DB.query(
      `
                SELECT u.id, u.data
                FROM users u
                WHERE u.id = $1
                GROUP BY u.id
            `,
      [userId]
    );
    const user = queryData.rows[0] || {};
    if (!user.id) {
      const queryResult = await DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      );
      user.id = queryResult.rows[0].id;
      user.data = userData;
    } else {
      await DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      );
    }
    return new User({ ...user, createdFromBuilder: true });
  }

  async lastMsgCheck({ msgId } = {}) {
    const activeEvent = !msgId && this.lastMsg?.id;
    const oldEvent = msgId && this.lastMsg?.id !== msgId;
    if (activeEvent || oldEvent) {
      await this.sendSimpleError({
        error:
          this.lastMsg?.lastMsgCheckErrorText ||
          (oldEvent
            ? "Эта задача уже не актуальна"
            : "Последнее действие должно быть завершено"),
      });
      return false;
    } else {
      return true;
    }
  }
  resetCurrentAction() {
    delete this.lastMsg;
    delete this.currentAction;
  }
  async sendSystemErrorMsg({ err } = {}) {
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Попробуй обновить меня командой /start и попробовать все заново.\n`;
    const errText = `\nError message: '${err?.message}'.`;

    await BOT.sendMessage(
      this.simpleMsgWrapper.call(this, {
        text: sorryText + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
  simpleMsgWrapper({ ...options } = {}) {
    return {
      userId: this.id,
      chatId: this.currentChat,
      ...options,
    };
  }

  startMenuMarkup() {
    return [];
  }
  menuItem(item) {
    if (item.actionHandler)
      this.#textHandlerList[item.text] = item.actionHandler;
    return { ...item, actionHandler: undefined };
  }
  menuReady(value) {
    if (value !== undefined) {
      this.#menuReady = value;
    } else {
      return this.#menuReady;
    }
  }
  getMenuHandler(handler) {
    return this.#textHandlerList[handler];
  }
  async handleMenuAction(handler) {
    if (!this.menuReady()) {
      this.startMenuMarkup.call(this);
      this.menuReady(true);
    }
    const menuHandler = this.getMenuHandler(handler);
    if (menuHandler) {
      return await menuHandler.call(this);
    } else {
      return false;
    }
  }

  async startMsg({ msg } = {}) {
    await BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text: `Приветствую! У вас есть меню.`,
        keyboard: this.startMenuMarkup.call(this),
      })
    );
    this.menuReady(true);
    await BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text: `У вас есть вопросы?`,
        inlineKeyboard: [
          [{ text: "Вопросов нет, давай начинать!", callback_data: "hello" }],
        ],
      })
    );
  }

  async help() {
    if (!this.currentAction) {
      await this.sendSimpleAnswer({
        text: "Выберите одно из действий, которые можно совершить.",
      });
    } else {
      this.currentAction?.help();
    }
  }
  async sendSimpleAnswer({ text }) {
    const inlineKeyboard = [];
    await BOT.sendMessage({
      chatId: this.currentChat,
      text,
      inlineKeyboard,
    });
  }
  async sendSimpleError({ error }) {
    await BOT.sendMessage({
      chatId: this.currentChat,
      text:
        "<b>Ошибка</b>: " +
        error +
        (this.lastMsg?.id
          ? "\n<i>Актуальная задача прикреплена к данному сообщению.</i>"
          : ""),
      replyId: this.lastMsg?.id,
    });
  }

  async newBroadcast() {
    // if (await this.lastMsgCheck()) {
    //   this.resetCurrentAction();
      this.currentAction = await Broadcast.build({ parent: this });
      this.currentAction.start();
    // }
  }
}
