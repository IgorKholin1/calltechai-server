function wrapInSsml(text, languageCode, voiceName = '', mode = 'default') {
  // Удаляем опасные символы
  const safeText = String(text)
    .replace(/&/g, 'и')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/\//g, '');

  // Optimized pause times based on mode
  let pauseTime = '100ms'; // Reduced from 300ms
  
  switch (mode) {
    case 'greeting':
      pauseTime = '150ms'; // Slightly longer for greetings
      break;
    case 'thinking':
      pauseTime = '200ms'; // Reduced thinking pause
      break;
    case 'final':
      pauseTime = '100ms'; // Quick final response
      break;
    case 'clarify':
      pauseTime = '150ms'; // Moderate for clarifications
      break;
    case 'goodbye':
      pauseTime = '300ms'; // Keep longer for goodbyes
      break;
    default:
      pauseTime = '100ms'; // Default fast response
  }

  // Английский с эмоцией только для Joanna
  if (languageCode === 'en-US' && voiceName === 'Polly.Joanna') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="${pauseTime}"/>
          ${safeText}
        </prosody>
      </speak>
    `.trim();
  }

  // Русский и обычный английский (без эмоции)
  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="${pauseTime}"/>
          ${safeText}
        </prosody>
      </speak>
    `.trim();
  }

  // Остальное — просто SSML без атрибутов
  return `<speak>${safeText}</speak>`.trim();
}

module.exports = wrapInSsml;