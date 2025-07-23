document.getElementById("copiar").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "copiar_sinais" }, function (response) {
      const status = document.getElementById("status")
      if (response && response.sucesso) {
        status.innerText = "Sinais copiados com sucesso!"
      } else {
        status.innerText = "Erro ao copiar sinais."
      }
    })
  })
})
