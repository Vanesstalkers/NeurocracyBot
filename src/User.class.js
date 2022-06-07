import { BuildableClass } from "./Base.class.js";
//import Broadcast from "./userEvents/broadcast.js";
import Table from "./userEvents/table.js";
import Question from "./userEvents/question.js";
import { toCBD } from "./Lobby.class.js";
import skillLST from "./lst/skill.js";
import helpQuestionLST from "./lst/helpQuestion.js";
import { numberToEmoji } from "./utils.js";

export default class User extends BuildableClass {
  id;
  #textHandlerList = {};
  #menuReady = false;
  constructor(userData = {}) {
    super(...arguments);
    this.id = userData.id;
    this.telegram = userData.telegram;
    this.alertCount = parseInt(userData.data.alert_count || "0");
    this.skillList = userData.data.skillList;
    this.needConfigSkills = userData.data.needConfigSkills;
  }
  static async build({ userId, chatId, telegramData = {} } = {}) {
    const errorHandler = async function (err) {
      User.sendSystemErrorMsg({ err, userId, chatId });
      throw new Error(err);
    };

    const queryData = await DB.query(
      `
                SELECT u.id, u.data, u.telegram, count(a) alert_count
                FROM users u
                  LEFT JOIN user_alert a ON a.user_id = u.id AND a.delete_time IS NULL
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
    const menu = [
      [
        this.menuItem({
          text: "🏆 Вопрос",
          actionHandler: async function () {
            await this.newQuestionEvent();
          },
        }),
        this.menuItem({
          text: "🏆 Оценка",
          actionHandler: async function () {
            console.log("🏆 Оценка");
          },
        }),
      ],
      [
        this.menuItem({
          text: "🎓 Навыки",
          web_app: {
            url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=skillList`,
          },
        }),
        this.menuItem({
          text: this.alertCount > 0 ? `🔔 (${this.alertCount})` : "🔕",
          web_app: {
            url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=alertList`,
          },
        }),
        this.menuItem({
          text: "🛠️ Меню",
          actionHandler: async function () {
            console.log("🛠️ Меню");
          },
        }),
      ],
    ];
    this.menuReady(true);
    return menu;
  }
  static getDefaultUserData() {
    const skillList = {};
    for (const skillCode of Object.keys(skillLST)) {
      skillList[skillCode] = {
        value: parseFloat((Math.random() * 10).toFixed(1)),
        update: 0,
      };
    }
    return {
      skillList,
      needConfigSkills: { value: 30 },
    };
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
      "Что еще вы хотели бы узнать, прежде чем начать оценку собственных компетенций? <u>Cейчас и далее, когда понадобится подсказка, выбирайте пункты со значком</u> ℹ️";
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
        callback_data: toCBD("acceptConfig"),
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
  async acceptConfig() {
    this.resetCurrentAction();
    if (this.needConfigSkills.value) {
      await BOT.sendMessage(
        this.simpleMsgWrapper({
          text: "Отлично, для вас есть первое задание! Необходимо указать ваши сильные стороны в общем списке компетенций.",
          inlineKeyboard: [
            [
              {
                text: "Распределить компетенции",
                callback_data: toCBD("showSkills"),
              },
            ],
            [
              {
                text: "🎓 Распределить навыки",
                web_app: {
                  url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=skillList`,
                },
              },
            ],
          ],
        })
      );
    } else {
      await this.sendSimpleAnswer({
        text: "Выберите одно из двух действий, которые можно совершить на нашей платформе.",
      });
    }
  }

  async newQuestionEvent() {
    if (await this.checkLastMsg()) {
      this.resetCurrentAction();
      this.currentAction = await Question.build({ parent: this });
    }
  }
  async newRateEvent() {
    if (await this.checkLastMsg()) {
      this.resetCurrentAction();
      // this.currentAction = await Rate.build({ parent: this });
    }
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
  async sendSimpleAnswer({ text, btnQ = true, btnA = true }) {
    const inlineKeyboard = [];
    if (btnQ)
      inlineKeyboard.push([
        {
          text: "Задать новый вопрос",
          callback_data: toCBD("newQuestionEvent"),
        },
      ]);
    if (btnA)
      inlineKeyboard.push([
        {
          text: "Оценить чужой вопрос",
          callback_data: toCBD("newRateEvent"),
        },
      ]);
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text,
        inlineKeyboard,
      })
    );
  }

  async showSkills() {
    this.resetCurrentAction();
    const table = await Table.build({ parent: this });
    this.currentAction = table;
    table.setSimpleMsgWrapper(this.simpleMsgWrapper.bind(this));
    table.setLST(skillLST);
    table.setItemKeyboardBuilder(
      function ({ tableItem, code: skillCode, customAttributes }) {
        const skill = this.skillList[skillCode] || {};
        let rateStr = numberToEmoji((skill.value || 0).toFixed(1).toString());
        let updateString = skill.update
          ? skill.update.toFixed(1).toString()
          : " ";
        if (updateString[0] != "-" && updateString[0] != " ")
          updateString = "+" + updateString;
        updateString = numberToEmoji(updateString);

        let result;

        if (this.needConfigSkills.value || customAttributes.startRateUpdated) {
          result = [
            { text: rateStr, callback_data: toCBD("null") },
            { text: updateString, callback_data: toCBD("null") },
            (skill.value || 0) < 10
              ? {
                  text: "➕",
                  callback_data: toCBD("setStartRate", skillCode, "+"),
                }
              : {
                  text: "➖",
                  callback_data: toCBD("setStartRate", skillCode, "-"),
                },
            tableItem.showInfo
              ? {
                  text: "🚫",
                  callback_data: toCBD("helpItem", skillCode, "hide"),
                }
              : {
                  text: "ℹ️",
                  callback_data: toCBD("helpItem", skillCode, "show"),
                },
          ];
        } else {
          result = [
            { text: rateStr, callback_data: toCBD("null") },
            { text: updateString, callback_data: toCBD("null") },
            tableItem.showInfo
              ? {
                  text: "🚫",
                  callback_data: toCBD("helpItem", skillCode, "hide"),
                }
              : {
                  text: "ℹ️",
                  callback_data: toCBD("helpItem", skillCode, "show"),
                },
          ];
        }
        return [result];
      }.bind(this)
    );
    table.setPaginationMsgTextBuilder(
      function () {
        return `Укажите в каких профессиональные компетенции, вы считаете своими сильными сторонами.\n<b>Осталось очков для распределения:</b> ${numberToEmoji(
          this.needConfigSkills.value
        )}\nℹ️ Список компетенций отсортирован в алфавитном порядке. Перелистывайте его кнопками ниже.`;
      }.bind(this)
    );
    table.setHandler(
      "setStartRate",
      async function ({ msgId, data: [skillCode, type] }) {
        if (!this.needConfigSkills.value) return;
        if (!this.skillList[skillCode])
          this.skillList[skillCode] = { value: 0, update: 0 };
        if (type === "+") {
          this.skillList[skillCode].value = parseFloat((parseFloat(this.skillList[skillCode].value) + 5).toFixed(1));
          this.skillList[skillCode].update = parseFloat((parseFloat(this.skillList[skillCode].update) + 5).toFixed(1));
          this.needConfigSkills.value -= 5;
        } else {
          if (this.skillList[skillCode].update) {
            this.skillList[skillCode].value = parseFloat((parseFloat(this.skillList[skillCode].value) - 5).toFixed(1));
            this.skillList[skillCode].update = parseFloat((parseFloat(this.skillList[skillCode].update) - 5).toFixed(1));
            this.needConfigSkills.value += 5;
          }
        }
        await DB.query(
          `
            UPDATE users
            SET data = jsonb_set(data, '{skillList, ${skillCode}}', $1, true)
            WHERE id = $2;
        `,
          [this.skillList[skillCode], this.id]
        );
        await DB.query(
          `
            UPDATE users
            SET data = jsonb_set(data, '{needConfigSkills, value}', $1, true)
            WHERE id = $2;
        `,
          [this.needConfigSkills.value, this.id]
        );
        await BOT.editMessageText(
          this.currentAction.createItemMsg({
            msgId,
            code: skillCode,
            customAttributes: {
              startRateUpdated: true,
            },
          })
        );
        await BOT.editMessageText(
          this.currentAction.createPaginationMsg({ msgId: this.lastMsg?.id })
        );
      }.bind(this)
    );
    table.start();
  }
  // async newBroadcast() {
  //   // if (await this.lastMsgCheck()) {
  //   //   this.resetCurrentAction();
  //     this.currentAction = await Broadcast.build({ parent: this });
  //     this.currentAction.start();
  //   // }
  // }
}
