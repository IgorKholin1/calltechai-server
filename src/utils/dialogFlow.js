function dialogFlowManager(intent, lang = 'en') {
    const responses = {
      en: {
        pricing: 'Would you like me to send the full price list?',
        appointment: 'Would you like me to help schedule an appointment?',
        insurance: 'Would you like to check if your insurance is accepted?',
        pain: 'Is the pain sharp, constant, or only when chewing?',
        location: 'Would you like directions sent to your phone?',
      },
      ru: {
        pricing: 'Хотите, я пришлю полный прайс-лист?',
        appointment: 'Хотите, я помогу вам с записью?',
        insurance: 'Хотите, я проверю вашу страховку?',
        pain: 'Боль резкая, постоянная или только при жевании?',
        location: 'Хотите, я отправлю вам маршрут?',
      }
    };
  
    return responses[lang]?.[intent] || null;
  }
  
  module.exports = { dialogFlowManager };