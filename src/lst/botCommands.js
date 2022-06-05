export default {
  "/start": {
    description: "Стартовое сообщение",
    action: async function () {
      await this.startMsg(...arguments);
    },
  },
  "/ask": {
    description: "Задача: задать вопрос",
    action: async function () {
      await this.newQuestionEvent(...arguments);
    },
  },
  "/rate": {
    description: "Задача: оценить вопрос",
    action: async function () {
      await this.newRateEvent(...arguments);
    },
  },
  "/help": {
    description: "help",
    action: async function () {
      await this.help(...arguments);
    },
  },
};
