import { Event } from "../Base.class.js";
import { toCBD } from "../Lobby.class.js";
import Question from "./question.js";
import skillLST from "../lst/skill.js";
import rateLST from "../lst/rate.js";
import { getRewardArray } from "../utils.js";

export default class Rate extends Event {
  static claimCountLimit = 3;
  config = { stepByStepMode: true };
  constructor() {
    super(...arguments);
  }
  static async build({ parent: user, customMode } = {}) {
    const rate = new Rate({ parent: user, createdFromBuilder: true });
    await rate.init({ customMode });
    return rate;
  }
  async help() {
    await BOT.sendMessage(
      this.getParent().simpleMsgWrapper({
        text: "Оцените вопрос и определите, к каким темам он относится.",
      })
    );
  }
  async init({ customMode: { mode, skillList = [], questionRate } = {} } = {}) {
    if (mode === "static") {
      this.skillList = skillList;
      this.questionRate = questionRate;
      return;
    }

    const user = this.getParent();
    this.skillList = [];
    if (this.config.stepByStepMode) this.step = 0;

    const question = await DB.query(
      `
        SELECT
            q.id, q.data
        FROM 
            question q
            LEFT JOIN answer a 
                    ON a.question_id = q.id AND a.user_id = $1
        WHERE
                (q.user_id != $1 OR q.user_id = $1)
            AND q.delete_time IS NULL
            AND a.id IS NULL
        LIMIT 1
      `,
      [user.id]
    );
    this.questionId = question.rows[0]?.id;

    if (!this.questionId) {
      await user.sendSimpleAnswer({
        text: "Новые вопросы проходят модерацию и будут доступны для оценки позже. Однако вы в любой момент можете задать свой вопрос.",
      });
      return;
    }

    const questionData = question.rows[0].data;
    for (const skill of questionData.skillList) {
      this.skillList.push({
        code: skill.code,
        text: "❓ " + skill.label,
      });
    }

    if (this.config.stepByStepMode) {
      await BOT.sendMessage(
        this.createMsgBySteps({
          text: questionData.text,
          info: "‼️ Оцените вопрос по шкале от 0 до 5",
        }),
        { text: questionData.text }
      );
    } else {
      await BOT.sendMessage(
        this.createMsg({
          text: questionData.text,
          info: 'ℹ️ Необходимо оценить вопрос по шкале от 0 до 5. Если вопрос не соответствует правилам, то нажмите кнопку "Жалоба".\n<b>Ниже перечислены профессиональные сферы, укажите для каждой - относится она к вопросу или нет.</b>',
        }),
        { text: questionData.text }
      );
      for (const skill of this.skillList) {
        const msg = await BOT.sendMessage(
          user.simpleMsgWrapper({
            text: skill.text,
            inlineKeyboard: this.createMsgSkillKeyboard({ skill }),
          }),
          { childMsg: true }
        );
        skill.msgId = msg.message_id;
      }
    }
  }
  createMsg({ text, error = null, info = null, reward = null } = {}) {
    const user = this.getParent();
    text = "<b>Вопрос:</b> " + (user.lastMsg?.text || text);
    let inlineKeyboard = [
      Array(6)
        .fill()
        .map((i, j) => ({ text: j, ...toCBD("setQuestionRate", j) })),
      [
        { text: "Сохранить", ...toCBD("save") },
        { text: "⚠️ Жалоба", ...toCBD("claim") },
        this.showInfo
          ? { text: "🚫", ...toCBD("helpRateQuestion", "hide") }
          : { text: "ℹ️ Подсказка", ...toCBD("helpRateQuestion", "show") },
      ],
    ];

    if (reward) {
      const rewardArray = getRewardArray({ rewardList: reward.data }) || [
        "<i>ошибка отображения награды</i>",
      ];
      text = reward.text + "\n" + rewardArray.join("\n") + "\n\n" + text;
      inlineKeyboard = [];
    }

    text +=
      "\n\n<b>Оценка вопроса</b>: " +
      (!this.questionRate ? "❓" : rateLST[this.questionRate]);

    const skills = [];
    for (const skill of this.skillList) {
      let label = skillLST[skill.code].label;
      if (skill.checked === undefined) {
        skills.push("❓ " + label);
      } else if (skill.checked) {
        skills.push("✔️ " + label);
      } else {
        skills.push("✖️ <s>" + label + "</s>");
      }
    }
    if (skills.length)
      text += "\n<b>Связанные сферы:</b> " + skills.join(", ") + ".";
    if (info) text += "\n\n" + info;
    if (error) text += "\n\n" + this.stringifyError.call(this, { error });
    return user.simpleMsgWrapper({
      msgId: user.lastMsg?.id,
      text,
      inlineKeyboard,
    });
  }
  createMsgBySteps({ text, error = null, info = null } = {}) {
    const user = this.getParent();
    text = "<b>Вопрос:</b> " + (user.lastMsg?.text || text);
    text +=
      "\n\n<b>Оценка вопроса</b>: " +
      (!this.questionRate ? "❓" : rateLST[this.questionRate]);
    const skills = [];
    for (const skill of this.skillList) {
      let label = skillLST[skill.code].label;
      if (skill.checked === undefined) {
        skills.push("❓ " + label);
      } else if (skill.checked) {
        skills.push("✔️ " + label);
      } else {
        skills.push("✖️ <s>" + label + "</s>");
      }
    }
    if (skills.length)
      text += "\n<b>Связанные сферы:</b> " + skills.join(", ") + ".";
    if (error) text += "\n\n" + this.stringifyError.call(this, { error });

    let inlineKeyboard = [];
    if (this.step === 0) {
      inlineKeyboard = inlineKeyboard.concat([
        Array(6)
          .fill()
          .map((i, j) => ({ text: j, ...toCBD("setQuestionRate", j) })),
        [
          { text: "⚠️ Жалоба модератору", ...toCBD("claim") },
          this.showInfo
            ? { text: "🚫", ...toCBD("helpRateQuestion", "hide") }
            : { text: "ℹ️ Подсказка", ...toCBD("helpRateQuestion", "show") },
        ],
      ]);
    } else {
      const skill = this.skillList[this.step - 1];
      if (skill) {
        text += `\n\n‼️ Определите, относится ли вопрос к профессиональной сфере: <b>${skill.text}</b>`;
        inlineKeyboard = this.createMsgSkillKeyboard({ skill });
      } else {
        text += `\n\n✔️ Спасибо, все удалось! Теперь вы можете сохранить ваши оценки.`;
        inlineKeyboard = [
          [
            { text: "Сохранить", ...toCBD("save") },
            { text: "Изменить оценки", ...toCBD("reset") },
          ],
        ];
      }
    }

    if (info) text += "\n\n" + info;

    return user.simpleMsgWrapper({
      msgId: user.lastMsg?.id,
      text,
      inlineKeyboard,
    });
  }
  createMsgSkillKeyboard({ skill }) {
    return [
      [
        { text: "Относится", ...toCBD("setSkillRate", skill.code, "+") },
        { text: "Не относится", ...toCBD("setSkillRate", skill.code, "-") },
        skill.showInfo
          ? { text: "🚫", ...toCBD("helpSkill", skill.code, "hide") }
          : { text: "ℹ️ Подсказка", ...toCBD("helpSkill", skill.code, "show") },
      ],
    ];
  }
  async setQuestionRate({ data: [rate] }) {
    this.questionRate = rate;
    if (this.config.stepByStepMode) {
      this.step += 1;
      await BOT.editMessageText(this.createMsgBySteps());
    } else {
      await BOT.editMessageText(this.createMsg());
    }
  }
  async setSkillRate({ data: [skillCode, rate] }) {
    const skill = this.skillList?.find((skill) => skill.code === skillCode);

    const skillCheched = rate === "+";
    if (skill.checked !== skillCheched) skill.checked = skillCheched;
    else return;

    let text = skillLST[skill.code].label;
    if (skillCheched) {
      text = "✔️ <b>" + text + "</b>";
    } else {
      text = "✖️ <s>" + text + "</s>";
    }
    if (this.config.stepByStepMode) {
      this.step += 1;
      await BOT.editMessageText(this.createMsgBySteps());
    } else {
      await BOT.editMessageText(
        this.getParent().simpleMsgWrapper({
          msgId: skill.msgId,
          text,
          inlineKeyboard: this.createMsgSkillKeyboard({ skill }),
        })
      );
      await BOT.editMessageText(this.createMsg());
      skill.text = text;
    }
  }
  async helpRateQuestion({ data: [toggleType] } = {}) {
    this.showInfo = toggleType === "show" ? true : false;
    const info = !this.showInfo
      ? ""
      : `‼️ <i><b>Необходимо поставить подходящую для вопроса оценку:</b> ${Object.values(
          rateLST
        )
          .map((rate) => `\n${rate}`)
          .join(";")}.</i>`;
    await BOT.editMessageText(
      this.config.stepByStepMode
        ? this.createMsgBySteps({ info })
        : this.createMsg({ info })
    );
  }
  async helpSkill({ data: [skillCode, toggleType] }) {
    const skill = this.skillList?.find((skill) => skill.code === skillCode);
    skill.showInfo = toggleType === "show" ? true : false;
    await BOT.editMessageText(
      this.config.stepByStepMode
        ? this.createMsgBySteps({
            info: !skill.showInfo
              ? ""
              : `ℹ️ <i>Cфера "${
                  skillLST[skill.code].label
                }" включает в себя: <u>${skillLST[skill.code].info}</u></i>`,
          })
        : this.getParent().simpleMsgWrapper({
            msgId: skill.msgId,
            text:
              skill.text +
              (!skill.showInfo
                ? ""
                : `\nℹ️ <i><u>${skillLST[skill.code].info}</u></i>`),
            inlineKeyboard: this.createMsgSkillKeyboard({ skill }),
          })
    );
  }
  async reset() {
    delete this.questionRate;
    for (const skill of this.skillList) {
      delete skill.checked;
    }
    this.step = 0;
    await BOT.editMessageText(
      this.createMsgBySteps({ info: "‼️ Оцените вопрос по шкале от 0 до 5" })
    );
  }
  async claim() {
    await BOT.sendMessage(
      this.getParent().simpleMsgWrapper({
        text: "⚠️Жалоба модератору отправляется в случае, если текст вопроса нарушает одно из следующих правил:\n- текст не является вопросом;\n- текст содержит ненормативную лексику;\n- текст нарушает законодательство РФ.\n<b>Вы подтверждаете нарушение одного из перечисленных правил?</b>",
        inlineKeyboard: [
          [
            { text: "Подтверждаю", ...toCBD("claimAccept") },
            { text: "Отменить", ...toCBD("claimCancel") },
          ],
        ],
      }),
      { saveAsLastConfirmMsg: true }
    );
  }
  async claimAccept() {
    const user = this.getParent();
    const question = await DB.query(
      `
        SELECT data -> 'claimCount' count
        FROM question
        WHERE id = $1
      `,
      [this.questionId]
    );
    const claimCount = question.rows[0]?.count || 0;

    if (claimCount < Rate.claimCountLimit) {
      await DB.query(
        `
          UPDATE question
          SET data = jsonb_set(data, '{claimCount}', $1, true)
          WHERE id = $2
        `,
        [claimCount + 1, this.questionId]
      );
    } else {
      await DB.query(
        `
          UPDATE question
          SET delete_time = NOW()::timestamp
          WHERE id = $1
        `,
        [this.questionId]
      );
    }
    await DB.query(
      `
        INSERT INTO answer
            (user_id, question_id, data, add_time, msg_id, chat_id)
        VALUES
            ($1, $2, $3, NOW()::timestamp, $4, $5)
      `,
      [
        user.id,
        this.questionId,
        { claim: true },
        user.lastMsg.id,
        user.currentChat,
      ]
    );

    await user.sendSimpleAnswer({
      text: "Благодарим за помощь в модерации платформы, ваша жалоба отправлена на рассмотрение.",
    });
    user.resetCurrentAction();
  }
  async claimCancel() {
    const user = this.getParent();
    await BOT.deleteMessage(
      user.simpleMsgWrapper({ msgId: user.lastMsg.confirmMsgId })
    );
  }
  async save() {
    let error = false;
    if (
      !this.questionRate ||
      this.skillList.filter((skill) => skill.checked === undefined).length
    ) {
      error = `Должны быть выставлены все оценки и определены все сферы.`;
    }
    const user = this.getParent();
    if (error) {
      if (await BOT.editMessageText(this.createMsg({ error }))) {
        await user.sendSimpleError({ error });
      }
    } else {
      const answerMsg = await DB.query({
        text: `
          INSERT INTO answer
              (user_id, question_id, data, add_time, msg_id, chat_id)
          VALUES
              ($1, $2, $3, NOW()::timestamp, $4, $5)
          RETURNING id;
        `,
        values: [
          user.id,
          this.questionId,
          { questionRate: this.questionRate, skillList: this.skillList },
          user.lastMsg?.id,
          user.currentChat,
        ],
      }).catch(async function (err) {
        await user.sendSystemErrorMsg({ err });
        throw new Error(err);
      });
      const answerId = answerMsg.rows[0].id;

      const queryResult = await DB.query({
        text: `
          UPDATE question 
          SET data = data || jsonb_build_object(
              'answerCount', (COALESCE(data->>'answerCount','0')::int + 1)::text::jsonb
          )
          WHERE id = $1 RETURNING data->>'answerCount' count;
        `,
        values: [this.questionId],
      }).catch(async function (err) {
        await user.sendSystemErrorMsg({ err });
        throw new Error(err);
      });

      await user.sendSimpleAnswer({ text: "Оценки сохранены." });
      user.resetCurrentAction();

      await Question.processRates({
        questionId: this.questionId,
        answerId,
        processUserId: user.id,
      });
    }
  }
}
