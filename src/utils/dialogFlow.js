function dialogFlowManager(intent, lang = 'en') {
    const prompts = {
      en: {
        pricing: "Would you like to book this service?",
        appointment: "Do you want me to help you schedule a time?",
        insurance: "Would you like to know if your insurance is accepted?",
        pain: "Would you like to schedule an emergency appointment?"
      },
      ru: {
        pricing: "Хотите записаться на эту услугу?",
        appointment: "Хотите, я помогу вам выбрать дату?",
        insurance: "Хотите, я уточню, принимаем ли мы вашу страховку?",
        pain: "Хотите записаться на ближайшее время?"
      }
    };
  
    return prompts[lang]?.[intent] || null;
  }
  
  module.exports = { dialogFlowManager };