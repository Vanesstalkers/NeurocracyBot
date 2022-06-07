import { BuildableClass } from "./Base.class.js";
//import Broadcast from "./userEvents/broadcast.js";
import helpQuestionLST from "./lst/helpQuestion.js";
import { toCBD } from "./Lobby.class.js";

export default class User extends BuildableClass {
  id;
  #textHandlerList = {};
  #menuReady = false;
  constructor(userData = {}) {
    super(...arguments);
    this.id = userData.id;
    this.telegram = userData.telegram;
  }
  static async build({ userId, chatId, telegramData = {} } = {}) {
    const errorHandler = async function (err) {
      User.sendSystemErrorMsg({ err, userId, chatId });
      throw new Error(err);
    };

    const queryData = await DB.query(
      `
                SELECT u.id, u.data, u.telegram
                FROM users u
                WHERE u.id = $1
                GROUP BY u.id
            `,
      [userId]
    ).catch(errorHandler);
    const user = queryData.rows[0] || {};
    if (!user.id) {
      user.data = this.getDefaultUserData();
      user.telegram = telegramData;
      const queryResult = await DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, user.data, user.telegram]
      ).catch(errorHandler);
      user.id = queryResult.rows[0].id;
    } else {
      await DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      ).catch(errorHandler);
    }
    return new User({ ...user, createdFromBuilder: true });
  }

  resetCurrentAction() {
    delete this.lastMsg;
    delete this.currentAction;
  }
  async setLastMsg({ msg, text, config } = {}) {
    if (config === true) {
      config = {
        lastMsgCheckErrorText: undefined, // тут можно написать кастомный текст
      };
    }
    if (config.saveAsLastConfirmMsg) {
      this.lastMsg.confirmMsgId = msg.message_id;
    } else {
      this.lastMsg = {
        id: msg.message_id,
        text,
        ...config,
      };
    }
  }
  async checkLastMsg({ msgId } = {}) {
    const activeEvent = !msgId && this.lastMsg?.id;
    const oldEvent =
      msgId &&
      this.lastMsg?.id &&
      this.lastMsg?.id !== msgId &&
      msgId !== this.lastMsg?.confirmMsgId &&
      !this.lastMsg?.childMsgIdList.includes(msgId);

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
  async sendSimpleError({ error }) {
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text:
          "<b>Ошибка</b>: " +
          error +
          (this.lastMsg?.id
            ? "\n<i>Актуальная задача прикреплена к данному сообщению.</i>"
            : ""),
        replyId: this.lastMsg?.id,
      })
    );
  }
  async sendSystemErrorMsg({ err } = {}) {
    User.sendSystemErrorMsg({ err, userId: this.id, chatId: this.currentChat });
  }
  static async sendSystemErrorMsg({ err, userId, chatId } = {}) {
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Можете обновить меня командой /start и попробовать все заново.`;
    const errText = `Error message: '${err?.message}'.`;

    await BOT.sendMessage(
      this.simpleMsgWrapper({
        userId,
        chatId,
        text: sorryText + " " + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
  simpleMsgWrapper({ ...options } = {}) {
    return User.simpleMsgWrapper({
      userId: this.id,
      chatId: this.currentChat,
      ...options,
    });
  }
  static simpleMsgWrapper({ userId, chatId, ...options } = {}) {
    return {
      userId: userId || this.id,
      chatId: chatId || this.currentChat,
      ...options,
    };
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
    if (!this.menuReady()) this.startMenuMarkup();
    const menuHandler = this.getMenuHandler(handler);
    if (menuHandler) {
      return await menuHandler.call(this);
    } else {
      return false;
    }
  }

  startMenuMarkup() {
    const menu = [];
    this.menuReady(true);
    return menu;
  }
  static getDefaultUserData() {
    return {};
  }
  async startMsg({ msg } = {}) {
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text: `Приветствую Вас, ${this.telegram.username}!`,
        keyboard: this.startMenuMarkup(),
      })
    );

    await BOT.sendMessage(this.createStartHelpMsg(), true);
  }
  createStartHelpMsg({ msgId, info = null } = {}) {
    let text =
      "На какие вопросы я могу ответить? <u>Cейчас и далее, когда понадобится подсказка, выбирайте пункты со значком</u> ℹ️";
    if (info) text += "\n\n" + info;

    const inlineKeyboard = Object.entries(helpQuestionLST).map(
      ([code, lst]) => {
        return [
          { text: `ℹ️ ${lst.text}?`, callback_data: toCBD("helpStart", code) },
        ];
      }
    );
    inlineKeyboard.push([
      {
        text: "✔️ Мне все понятно, начинаем!",
        callback_data: toCBD("null"),
      },
    ]);
    return this.simpleMsgWrapper({ msgId, text, inlineKeyboard });
  }
  async helpStart({ data: [questionCode] }) {
    const question = helpQuestionLST[questionCode];
    const info = `ℹ️ <b>${question.text}?</b>\n\n<i>${question.info}</i>`;
    await BOT.editMessageText(
      this.createStartHelpMsg({ msgId: this.lastMsg?.id, info })
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
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text,
        inlineKeyboard,
      })
    );
  }

  // async newBroadcast() {
  //   // if (await this.lastMsgCheck()) {
  //   //   this.resetCurrentAction();
  //     this.currentAction = await Broadcast.build({ parent: this });
  //     this.currentAction.start();
  //   // }
  // }
}
