import { Event } from "../Base.class.js";
import { toCBD } from "../Lobby.class.js";
import skillLST from "../lst/skill.js";
import { getRewardArray } from "../utils.js";

export default class Question extends Event {
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user, customMode } = {}) {
    const question = new Question({ parent: user, createdFromBuilder: true });
    await question.init({ customMode });
    return question;
  }
  async help() {
    await BOT.sendMessage(
      this.getParent().simpleMsgWrapper({
        text: "Задайте вопрос, относящийся одновременно ко всем отмеченным вами темам.",
      })
    );
  }
  async init({ customMode: { mode, skillList = [] } = {} } = {}) {
    this.onTextReceivedHandler = this.save;

    if (mode === "static") {
      this.skillList = skillList;
      return;
    }

    this.skillList = [];
    const skillListKeys = Object.keys(skillLST);
    for (let j = 0; j < 4; j++) {
      const skillCode = skillListKeys.splice(
        Math.floor(Math.random() * skillListKeys.length),
        1
      )[0];
      this.skillList.push({
        code: skillCode,
        label: skillLST[skillCode].label,
        checked: false,
      });
    }
    await BOT.sendMessage(this.createMsg(), true);
  }
  createMsg({ error = null, info = null, reward = null } = {}) {
    const user = this.getParent();
    const hideInfo = this.info && !this.info.hide;

    let text =
      "Выберите от 2 до 4 сфер компетенций из предложенного списка и задайте свой вопрос, относящийся одновременно ко всем выбранным навыкам (<u>отправьте его как обычное сообщение в чат</u>).";
    let inlineKeyboard = [
      [
        { text: "Заменить список", ...toCBD("changeSkills") },
        {
          text: `ℹ️ ${hideInfo ? "скрыть" : "Подсказка"}`,
          ...toCBD("showSkillsDecription"),
        },
      ],
    ].concat(this.keyboardFromSkills());

    if (reward) {
      const rewardArray = getRewardArray({ rewardList: reward.data }) || [
        "<i>ошибка отображения награды</i>",
      ];
      text =
        reward.text +
        "\n" +
        rewardArray.join("\n") +
        "\n\n" +
        "<b>Задан вопрос:</b> " +
        user.lastMsg.text;
      inlineKeyboard = [];
    }

    if (hideInfo) text += "\n\n" + this.info.text;
    text += "\n" + this.stringifyCheckedSkills();
    if (error) text += "\n\n" + this.stringifyError({ error });

    return user.simpleMsgWrapper({
      msgId: user.lastMsg?.id,
      text,
      inlineKeyboard,
    });
  }
  async save({ text }) {
    const checkedSkillList = this.getCheckedSkills();
    const minQuestionLength = 10;
    let error = false;

    if (checkedSkillList.length < 2) {
      error = `Должно быть выбрано минимум 2 сферы компетенций.`;
    } else if (text.length < minQuestionLength) {
      error = `Длина вопроса меньше необходимой (минимальное количество символов: ${minQuestionLength}).`;
    }
    const user = this.getParent();
    if (error) {
      if (await BOT.editMessageText(this.createMsg({ error }))) {
        await user.sendSimpleError({ error });
      }
    } else {
      await DB.query(
        `
          INSERT INTO question
              (user_id, data, add_time, msg_id, chat_id)
          VALUES
              ($1, $2, NOW()::timestamp, $3, $4)
        `,
        [
          user.id,
          { text, skillList: this.skillList },
          user.lastMsg.id,
          user.currentChat,
        ]
      ).catch(async function (err) {
        await user.sendSystemErrorMsg({ err });
        throw new Error(err);
      });
      await user.sendSimpleAnswer({
        text:
          `Cохранен вопрос:\n<b>${text}</b>.\nВыбраные компетенции:\n` +
          checkedSkillList.map((skill) => `<b>${skill.label}</b>`).join(", ") +
          ".",
      });
      user.resetCurrentAction();
    }
  }
  getCheckedSkills() {
    return this.skillList.filter((skill) => skill.checked);
  }
  stringifyCheckedSkills() {
    const checkedSkillList = this.getCheckedSkills();
    return !checkedSkillList.length
      ? ""
      : "\n<b>Выбраны сферы:</b> " +
          checkedSkillList
            .reduce((arr, skill) => arr.concat(["✔️" + skill.label]), [])
            .join(", ") +
          ".";
  }
  keyboardFromSkills() {
    return this.skillList.map((skill) => {
      const buttonList = [
        { text: skill.label, ...toCBD("updateSkills", skill.code, "pick") },
      ];
      if (skill.checked)
        buttonList.push({
          text: "отменить выбор",
          ...toCBD("updateSkills", skill.code, "delete"),
        });
      return buttonList;
    });
  }
  async changeSkills() {
    await BOT.sendMessage(
      this.getParent().simpleMsgWrapper({
        text: "ℹ️ Вы можете заменить предложенные сферы компетенций, однако платформа расценит это как недостаток соответствующих знаний и навыков, из-за чего несколько понизит оценки ваших характеристик.\n<b>Вы подтверждаете замену списка сфер компетенций для вопроса?</b>",
        inlineKeyboard: [
          [
            { text: "Подтвердить замену", ...toCBD("acceptChangeSkills") },
            { text: "Отменить замену", ...toCBD("cancelChangeSkills") },
          ],
        ],
      }),
      { saveAsLastConfirmMsg: true }
    );
  }
  async acceptChangeSkills() {
    const user = this.getParent();
    user.resetCurrentAction();
    await user.sendSimpleAnswer({
      text: "Вы можете заново выбрать одно из действий.",
    });
  }
  async cancelChangeSkills({ msgId }) {
    const user = this.getParent();
    await BOT.deleteMessage({
      userId: user.id,
      chatId: user.currentChat,
      msgId,
    });
  }
  async updateSkills({ data: [skillCode, actionType] }) {
    const skill = this.skillList.find((skill) => skill.code === skillCode);
    if (skill.checked && actionType === "pick") return; // already checked skill
    skill.checked = actionType === "pick";
    await BOT.editMessageText(this.createMsg());
  }
  async showSkillsDecription() {
    if (this.info) {
      this.info.hide = !this.info.hide;
    } else {
      const info = [];
      for (const skill of this.skillList) {
        const lstSkill = skillLST[skill.code];
        info.push(
          `ℹ️ <b>${lstSkill.label}:</b> <i>${lstSkill.info || "-"}</i>`
        );
      }
      this.info = {
        hide: false,
        text: info.join("\n"),
      };
    }
    await BOT.editMessageText(this.createMsg());
  }

  static async processRates({ questionId, answerId, processUserId } = {}) {
    const queryResult = await DB.query({
      text: `
        (
            SELECT
                'question' as type, q.data, u.id user_id, u.data user_data, ua.data->'reward' alert_data, q.msg_id, q.chat_id
            FROM
                question q
                LEFT JOIN users u
                  ON u.id = q.user_id
                  LEFT JOIN user_alert ua
                    ON ua.user_id = u.id AND CAST(ua.data ->> 'source_id' as bigint) = q.msg_id AND ua.data ->> 'source_type' = 'question'
            WHERE q.id = $1
        ) UNION ALL (
            SELECT
            'answer' as type, a.data, u.id user_id, u.data user_data, ua.data->'reward' alert_data, a.msg_id, a.chat_id
            FROM
                question q
                LEFT JOIN answer a
                  ON a.question_id = q.id AND a.delete_time IS NULL
                LEFT JOIN users u
                  ON u.id = a.user_id
                  LEFT JOIN user_alert ua
                    ON ua.user_id = u.id AND CAST(ua.data ->> 'source_id' as bigint) = a.msg_id AND ua.data ->> 'source_type' = 'answer'
            WHERE q.id = $1
        )
      `,
      values: [questionId],
    }).catch(function (err) {
      throw new Error(err);
    });
    const userMap = {};
    const itemsMappedByUser = {};
    const skillMap = {};
    let question;

    for (const item of queryResult.rows) {
      if (!userMap[item.user_id]) {
        userMap[item.user_id] = {
          update: {},
          reward: {},
          alertData: item.alert_data || {},
          skillList: item.user_data.skillList,
        };
      }
      if (!itemsMappedByUser[item.user_id]) {
        itemsMappedByUser[item.user_id] = {
          type: item.type,
          msgId: item.msg_id,
          chatId: item.chat_id,
          skillList: item.data.skillList || [],
          questionRate: item.data.questionRate,
          text: item.data.text,
          answerCount: item.data.answerCount,
          checkStatus: item.data.checkStatus || null,
        };
      }
      if (item.type === "question") {
        question = itemsMappedByUser[item.user_id];
        if (question.answerCount >= 3 && question.checkStatus === null)
          question.needCheck = "first";
        else if (question.answerCount >= 10 && question.checkStatus === "first")
          question.needCheck = "second";
      }
    }
    if (!question)
      throw new Error(`question (questionId=${questionId}) not found`);

    for (const [userId, item] of Object.entries(itemsMappedByUser)) {
      const user = userMap[userId];
      for (const skill of item.skillList) {
        if (!skillMap[skill.code]) {
          skillMap[skill.code] = [];
          skillMap[skill.code].skillSum = 0;
        }
        skillMap[skill.code].push({
          userId,
          skill: parseFloat(user.skillList[skill.code]?.value) || 0,
          rate: skill.checked,
        });
        skillMap[skill.code].skillSum +=
          parseFloat(user.skillList[skill.code]?.value) || 0;
      }
    }

    for (const [skillCode, skillData] of Object.entries(skillMap)) {
      skillData.rateSum = skillData.reduce(
        (sum, user) => sum + user.skill * (user.rate ? 1 : -1),
        0
      );
      // тема соответствует вопросу
      skillData.accepted = skillData.rateSum > 0;
      // коэффициент расхождения мнений
      skillData.rateIndex =
        skillData.skillSum > 0
          ? Math.abs(skillData.rateSum / skillData.skillSum)
          : 0;

      for (const user of skillData) {
        // личный коэффициент пользователя
        user.rateIndex = {
          "+": 1 / Math.pow(2, (user.skill - 100) / 10),
          "-": 1 / Math.pow(2, -user.skill / 10),
        };
        let updateSkill;
        if (user.rate !== skillData.accepted) {
          updateSkill =
            -1 *
            user.skill *
            user.rateIndex["-"] *
            skillData.rateIndex *
            0.0001;
        } else {
          updateSkill =
            (100 - user.skill) *
            user.rateIndex["+"] *
            skillData.rateIndex *
            0.0001;
        }

        userMap[user.userId].update[skillCode] =
          parseFloat(updateSkill.toFixed(1)) -
          parseFloat(userMap[user.userId].alertData[skillCode] || 0);
        userMap[user.userId].reward[skillCode] = parseFloat(
          updateSkill.toFixed(1)
        );
      }
    }

    const query = {
      text: "",
    };
    for (const [userId, userData] of Object.entries(userMap)) {
      if (userId !== processUserId && !question.needCheck) continue;

      const lobbyUser = await LOBBY.getUser({ userId, chatId: userId });
      if (lobbyUser) {
        let updateSkillQuery = [];
        for (const [code, value] of Object.entries(userData.update)) {
          if (!lobbyUser.skillList[code])
            lobbyUser.skillList[code] = { value: 0.0, update: 0.0 };
          lobbyUser.skillList[code].value = (
            parseFloat(lobbyUser.skillList[code].value) + value
          ).toFixed(1);
          lobbyUser.skillList[code].update = (
            parseFloat(lobbyUser.skillList[code].update) + value
          ).toFixed(1);

          updateSkillQuery.push(`
            '${code}', COALESCE(data->'skillList'->'${code}', jsonb '{}') ||
            jsonb_build_object(
                'value', ${lobbyUser.skillList[code].value}::float4,
                'update', ${lobbyUser.skillList[code].update}::float4
            )
          `);
        }

        const updateSkillQuery_stringified = updateSkillQuery.join(",");
        query.text += `
          UPDATE users
          SET data = jsonb_set(data, '{skillList}', data->'skillList' || jsonb_build_object(${updateSkillQuery_stringified}), true)
          WHERE id = ${userId};
        `;

        const rewardItemData = itemsMappedByUser[userId];
        const alertData = {
          source_type: rewardItemData.type,
          source_id: rewardItemData.msgId,
          reward: userData.reward,
        };

        const alertData_stringified = JSON.stringify(alertData);
        query.text += `
          INSERT INTO user_alert (user_id, data, add_time)
          VALUES (${userId}, jsonb '${alertData_stringified}', NOW()::timestamp);
        `;

        lobbyUser.giveReward({
          msgId: rewardItemData.msgId,
          chatId: rewardItemData.chatId,
          rewardData: userData.reward,
          msgData: {
            type: rewardItemData.type,
            text: question.text,
            skillList: rewardItemData.skillList,
            questionRate: rewardItemData.questionRate || undefined,
          },
        });
      }
    }

    //console.log({ skillMap, userMap, query });

    await DB.query(query).catch(function (err) {
      throw new Error(err);
    });
  }
}
