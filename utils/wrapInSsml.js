function wrapInSsml(text, languageCode, voiceName = '') {
  // Удаляем опасные символы
  const safeText = String(text)
    .replace(/&/g, 'и')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '')
    .replace(/\//g, '');

  // Английский с эмоцией только для Joanna
  if (languageCode === 'en-US' && voiceName === 'Polly.Joanna') {
    return `
      <speak>
        <amazon:emotion name="excited" intensity="medium">
          <prosody rate="medium" pitch="medium">
            ${safeText}
          </prosody>
        </amazon:emotion>
      </speak>
    `.trim();
  }

  // Русский и обычный английский (без эмоции)
  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="300ms"/>
          ${safeText}
        </prosody>
      </speak>
    `.trim();
  }

  // Остальное — просто SSML без атрибутов
  return `<speak>${safeText}</speak>`.trim();
}

module.exports = wrapInSsml;