function wrapInSsml(text, languageCode, voiceName = '') {
  // Английский с кастомной эмоцией только для Joanna
  if (languageCode === 'en-US' && voiceName === 'Polly.Joanna') {
    return `
      <speak>
        <amazon:emotion name="excited" intensity="medium">
          <prosody rate="medium" pitch="medium">
            ${text}
          </prosody>
        </amazon:emotion>
      </speak>
    `.trim();
  }

  // Русский и другие английские голоса — стандартное оформление
  if (languageCode === 'ru-RU' || languageCode === 'en-US') {
    return `
      <speak>
        <prosody rate="medium" pitch="medium">
          <break time="300ms"/>
          ${text}
        </prosody>
      </speak>
    `.trim();
  }

  // Остальные случаи — return c SSML без параметров
  return `
    <speak>${text}</speak>
  `.trim();
}

module.exports = wrapInSsml;