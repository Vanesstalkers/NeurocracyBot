import { BuildableClass } from "./Base.class.js";
//import Broadcast from "./userEvents/broadcast.js";
import Table from "./userEvents/table.js";
import Question from "./userEvents/question.js";
import Rate from "./userEvents/rate.js";
import { toCBD } from "./Lobby.class.js";
import skillLST from "./lst/skill.js";
import helpQuestionLST from "./lst/helpQuestion.js";
import { numberToEmoji } from "./utils.js";

export default class User extends BuildableClass {
  id;
  config = { showSkillsInApp: false };
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
  async setLastMsg({ id, text, config = {} } = {}) {
    if (config === true) {
      config = {
        lastMsgCheckErrorText: undefined, // тут можно написать кастомный текст
      };
    }
    if (config.saveAsLastConfirmMsg) {
      this.lastMsg.confirmMsgId = id;
    } else {
      if (config.childMsg) {
        if (this.lastMsg) {
          if (!this.lastMsg.childMsgIdList) this.lastMsg.childMsgIdList = [];
          this.lastMsg.childMsgIdList.push(id);
        }
      } else {
        this.lastMsg = { id, text, ...config };
      }
    }
  }
  async checkLastMsg({ msgId } = {}) {
    const activeEvent = !msgId && this.lastMsg?.id;
    const oldEvent =
      msgId &&
      this.lastMsg?.id &&
      this.lastMsg?.id !== msgId &&
      msgId !== this.lastMsg?.confirmMsgId &&
      !this.lastMsg?.childMsgIdList?.includes(msgId);

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
    await User.sendSystemErrorMsg({
      err,
      userId: this.id,
      chatId: this.currentChat,
    });
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
            await this.newRateEvent();
          },
        }),
      ],
      [
        this.menuItem(
          this.config.showSkillsInApp
            ? {
                text: "🎓 Навыки",
                web_app: {
                  url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=skillList`,
                },
              }
            : {
                text: "🎓 Навыки",
                actionHandler: async function () {
                  await this.showSkills();
                },
              }
        ),
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
  async startMsg() {
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
        return [{ text: `ℹ️ ${lst.text}?`, ...toCBD("helpStart", code) }];
      }
    );
    inlineKeyboard.push([
      { text: "✔️ Мне все понятно, начинаем!", ...toCBD("acceptConfig") },
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
              this.config.showSkillsInApp
                ? {
                    text: "🎓 Распределить навыки",
                    web_app: {
                      url: `${CONFIG.webapp.url}/?user_id=${this.id}&action=skillList`,
                    },
                  }
                : { text: "🎓 Распределить навыки", ...toCBD("showSkills") },
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
      this.currentAction = await Rate.build({ parent: this });
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
        { text: "Задать новый вопрос", ...toCBD("newQuestionEvent") },
      ]);
    if (btnA)
      inlineKeyboard.push([
        { text: "Оценить чужой вопрос", ...toCBD("newRateEvent") },
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
        let rateStr = numberToEmoji(
          parseFloat(skill.value || 0)
            .toFixed(1)
            .toString()
        );
        let updateString = skill.update
          ? parseFloat(skill.update).toFixed(1).toString()
          : " ";
        if (updateString[0] != "-" && updateString[0] != " ")
          updateString = "+" + updateString;
        updateString = numberToEmoji(updateString);

        let result;

        if (this.needConfigSkills.value || customAttributes.startRateUpdated) {
          result = [
            { text: rateStr, ...toCBD("null") },
            { text: updateString, ...toCBD("null") },
            (skill.value || 0) < 10
              ? { text: "➕", ...toCBD("setStartRate", skillCode, "+") }
              : { text: "➖", ...toCBD("setStartRate", skillCode, "-") },
            tableItem.showInfo
              ? { text: "🚫", ...toCBD("helpItem", skillCode, "hide") }
              : { text: "ℹ️", ...toCBD("helpItem", skillCode, "show") },
          ];
        } else {
          result = [
            { text: rateStr, ...toCBD("null") },
            { text: updateString, ...toCBD("null") },
            tableItem.showInfo
              ? { text: "🚫", ...toCBD("helpItem", skillCode, "hide") }
              : { text: "ℹ️", ...toCBD("helpItem", skillCode, "show") },
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

        let skillObj = {
          value: parseFloat(this.skillList[skillCode].value),
          update: parseFloat(this.skillList[skillCode].update),
        };
        let needConfigSkillsValue = this.needConfigSkills.value;
        if (type === "+") {
          skillObj.value = parseFloat((skillObj.value + 5).toFixed(1));
          skillObj.update = parseFloat((skillObj.update + 5).toFixed(1));
          needConfigSkillsValue -= 5;
        } else {
          if (this.skillList[skillCode].update) {
            skillObj.value = parseFloat((skillObj.value - 5).toFixed(1));
            skillObj.update = parseFloat((skillObj.update - 5).toFixed(1));
            needConfigSkillsValue += 5;
          }
        }
        try {
          if (
            await this.updateSkillList({
              skillList: { ...this.skillList, [skillCode]: skillObj },
              needConfigSkillsValue,
            }).catch(async function (err) {
              throw new Error(err);
            })
          ) {
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
              this.currentAction.createPaginationMsg({
                msgId: this.lastMsg?.id,
              })
            );
          }
        } catch (err) {
          await this.sendSystemErrorMsg({ err });
          throw new Error(err);
        }
      }.bind(this)
    );
    table.start();
  }
  async updateSkillList({ skillList, needConfigSkillsValue } = {}) {
    if (
      await DB.query({
        text: `
          UPDATE users
          SET data = data || jsonb_build_object(
            'skillList', $1::jsonb, 
            'needConfigSkills', data->'needConfigSkills' || $2::jsonb
          )
          WHERE id = $3;
        `,
        values: [skillList, { value: needConfigSkillsValue }, this.id],
      }).catch(async (err) => {
        throw new Error(err);
      })
    ) {
      this.skillList = skillList;
      this.needConfigSkills.value = needConfigSkillsValue;
    }
    return true;
  }
  async giveReward({ msgId, chatId, rewardData, msgData }) {
    this.setLastMsg({ id: msgId, text: msgData.text });
    const buildObj = {
      parent: this,
      customMode: {
        mode: "static",
        skillList: msgData.skillList,
        questionRate: msgData.questionRate,
      },
    };
    const event =
      msgData.type === "question"
        ? await Question.build(buildObj)
        : await Rate.build(buildObj);

    await BOT.editMessageText(
      event.createMsg({
        reward: {
          text: "<u>Обновлены оценки навыков:</u>",
          data: rewardData,
        },
      })
    );
    await BOT.pinChatMessage({ chatId, msgId });
    await this.newAlert({
      text: "🏆 Получена награда",
      replyId: msgId,
      chatId,
    });
  }
  async getAlertList() {
    const query = {
      text: `
        SELECT
            alert.id,
            alert.data,
            CASE
                WHEN alert.data ->> 'source_type' = 'question' 
                THEN (
                    SELECT q.data FROM question q 
                    WHERE CAST(alert.data ->> 'source_id' as bigint) = q.msg_id
                ) 
                ELSE (
                    SELECT jsonb_set(a.data, '{question}', aq.data)
                    FROM answer a 
                        LEFT JOIN question aq ON a.question_id = aq.id
                    WHERE CAST(alert.data ->> 'source_id' as bigint) = a.msg_id
                )
            END as source_data
        FROM
            user_alert alert
        WHERE
            user_id = $1
      `,
      values: [this.id],
    };

    const queryResult = await DB.query(query).catch((err) => {
      throw new Error(err);
    });
    //console.log({ queryResult });
    return queryResult.rows || [];
  }

  async newAlert({ text, replyId }) {
    this.alertCount += 1;
    await BOT.sendMessage(
      this.simpleMsgWrapper({
        text: text || "🔔 появились новые уведомления",
        keyboard: this.startMenuMarkup(),
        replyId,
      })
    );
    this.resetCurrentAction();
  }
  // async newBroadcast() {
  //   // if (await this.lastMsgCheck()) {
  //   //   this.resetCurrentAction();
  //     this.currentAction = await Broadcast.build({ parent: this });
  //     this.currentAction.start();
  //   // }
  // }
}
