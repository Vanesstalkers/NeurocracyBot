import { simpleMsgWrapper } from "./BotQueryHelper.js";
import { simpleMsgWrapper, checkListMsgWrapper } from "./BotQueryHelper.js";

export default class User {
  id;
  constructor() {}
  async init({ userId, userData = {}, telegramData = {} } = {}) {
    const queryData = await process.DB.query(
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
      const queryResult = await process.DB.query(
        `
                    INSERT INTO users (id, data, telegram, last_login)
                    VALUES ($1, $2, $3, NOW()::timestamp)
                    RETURNING id
                `,
        [userId, userData, telegramData]
      );
      this.id = queryResult.rows[0].id;
      user.data = userData;
    } else {
      this.id = user.id;
      await process.DB.query(
        `
                    UPDATE users
                    SET telegram = $1, last_login = NOW()::timestamp
                    WHERE id = $2
                `,
        [telegramData, userId]
      );
    }
    return this;
  }
  async startMsg({ msg } = {}) {
    await process.BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text: `Привет, друг!`,
        inlineKeyboard: [[{ text: "И тебе привет", callback_data: "hello" }]],
      })
    );
  }
  resetCurrentAction() {
    delete this.lastMsgId;
    delete this.currentAction;
    delete this.checkList;
  }
  async sendSystemErrorMsg({ err } = {}) {
    const sorryText = `У нас тут что-то сломалось, но программисты уже все чинят. Попробуй обновить меня командой /start и попробовать все заново.\n`;
    const errText = `\nError message: '${err?.message}'.`;

    await process.BOT.sendMessage(
      simpleMsgWrapper.call(this, {
        text: sorryText + errText,
        entities: [
          { type: "spoiler", offset: sorryText.length, length: errText.length },
        ],
      })
    );
  }
}
