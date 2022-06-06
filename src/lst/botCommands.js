export default {
  "/start": {
    description: "Стартовое сообщение",
    action: async function () {
      await this.startMsg(...arguments);
    },
  },
  "/help": {
    description: "help",
    action: async function () {
      await this.help(...arguments);
    },
  },
  "/admin": {
    admin: true,
    description: "admin",
    action: async function () {
      this.newBroadcast(...arguments);
    },
  },
};
