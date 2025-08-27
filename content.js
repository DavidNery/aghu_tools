function extractBalancoHidrico(tableDoc, peso) {
  const tableBH = tableDoc.querySelector("#tabelaVisualizacaoRegistrosBH")
  if(!tableBH) return null;
  const tableValue = tableBH.querySelector('.ui-datatable-frozenlayout-right');
  const tableHead = tableValue.querySelector('#tabelaVisualizacaoRegistrosBH_scrollableThead');
  const tableBody = tableValue.querySelector('#tabelaVisualizacaoRegistrosBH_scrollableTbody');
  const tableFoot = tableValue.querySelector('#tabelaVisualizacaoRegistrosBH_foot').children[0].querySelectorAll('td');
  
  let urinaIndex = 0, evacuacoesIndex = 0, vomitosIndex = 0;
  const urinaAndEvacuacoes = [...tableHead.querySelectorAll('th')].forEach((el, index) => {
    if(el.innerText === 'Urina') urinaIndex = index;
    if(el.innerText === 'Evacuou') evacuacoesIndex = index;
    if(el.innerText === 'Vômitos') vomitosIndex = index;
  })
  
  const diurese = parseInt(tableFoot[urinaIndex].innerText);
  const evacuacoes = [...tableBody.querySelectorAll('tr')].reduce((total, current) => {
    return total + (current.children[evacuacoesIndex].innerText === 'Sim' ? 1 : 0);
  }, 0)
  let vomitos = [...tableBody.querySelectorAll('tr')].reduce((total, current) => {
    return total + (current.children[vomitosIndex].innerText === 'Sim' ? 1 : 0);
  }, 0)
  
  return `DIURESE: ${diurese} ML - ${(diurese / peso / 24).toFixed(2)} ML/KG/H | EVACUAÇÕES: ${evacuacoes}X | RG: ${vomitos}X`;
}

function extractSinaisVitais(tableDoc) {
  const svSuffix = {
    'Tax': 'ºC', 'FC': ' bpm', 'FR': ' irpm', 'PS': ' mmHg', 'PD': ' mmHg',
    'BCF': ' bpm', 'SO2': '%', 'FiO2': '%', 'P': 'g'
  }

  const head = tableDoc.querySelector("#tabelaVisualizacaoRegistrosM_head")
  const body = tableDoc.querySelector("#tabelaVisualizacaoRegistrosM_data")
  if (!head || !body) return "Tabela não encontrada."

  const ssvv = {}
  const hgt = { column: undefined, values: [] }

  let pesoCol = undefined
  let pesoValor = undefined
  let pesoHorario = undefined

  const hColumns = head.children[0].children
  for (let i = 2; i < hColumns.length - 2; i++) {
    const title = hColumns[i].innerText.trim().replace(/ pedI?/ig, '')
    if (title === "HGT") hgt.column = i
    else if (title === "P" || title === 'PESO') pesoCol = i
    else ssvv[title] = { min: 0, max: 0 }
  }

  const rows = body.children
  for (const row of rows) {
    const cells = row.children
    for (let j = 2; j < hColumns.length - 2; j++) {
      const cell = cells[j]
      if (!cell || cell.innerText.trim() === "") continue

      if (pesoCol === j && pesoValor == null) {
        pesoValor = cell.innerText.trim()
        pesoHorario = cells[1].innerText.trim()
        continue
      }

      if (hgt.column === j) {
        hgt.values.push({ date: cells[1].innerText, value: cell.innerText })
        continue
      }

      const valor = parseFloat(cell.innerText.replace(",", "."))
      const sv = ssvv[hColumns[j].innerText.replace(/ pedI?/ig, '')]
      if (!sv) continue
      if (valor !== -1 && (sv.min === 0 || valor < sv.min)) sv.min = valor
      if (valor > sv.max) sv.max = valor
    }
  }

  let result = Object.entries(ssvv)
    .filter(([_, {min, max}]) => !isNaN(min) && !isNaN(max))
    .map(([sv, { min, max }]) => `${sv} ${min}-${max}${svSuffix[sv] || ""}`)
    .join(" / ")

  const balancoHidrico = extractBalancoHidrico(tableDoc, parseInt(pesoValor) / 1000.0);
  if(balancoHidrico) result += '\n' + balancoHidrico + '\n'

  if (hgt.values.length > 0) {
    result += "\nMAPA GLICÊMICO\n"
    const mapa = {}

    for (const { date, value } of hgt.values) {
      const [data, hora] = date.split(" ")
      const dataKey = data.slice(0, 5)
      if (!mapa[dataKey]) mapa[dataKey] = []
      mapa[dataKey].push({ value: value.replace(/mg\/dL/gi, "").trim(), hora: hora.split(":")[0] })
    }

    for (const dataKey in mapa) {
      mapa[dataKey].sort((v1, v2) => v1.hora < v2.hora ? -1 : 1)
      result += `${dataKey}: ${mapa[dataKey].map(({value, hora}) => `${value} (${hora}h)`).join(", ")}\n`
    }
  }

  if (pesoValor && pesoHorario) {
    const [data, hora] = pesoHorario.split(" ")
    const dataFormatada = data.slice(0, 5)
    const horaFormatada = hora.slice(0, 5)
    result += `\nPESO (${dataFormatada} ${horaFormatada}) = ${pesoValor}g`
  }

  return result
}

function tentarInjetar() {
  const iframes = document.querySelectorAll("iframe")

  for (const iframe of iframes) {
    try {
      const doc = iframe.contentWindow.document
      const botaoContainer = doc.querySelector("#j_idt184")

      if (botaoContainer && !doc.getElementById("btnCopiarSinaisVitais")) {
        console.log("[AGHUtools] Injetando botão...")

        const botao = doc.createElement("button")
        botao.id = "btnCopiarSinaisVitais"
        botao.className = 'ui-button ui-widget ui-state-default ui-corner-all ui-button-text-icon-left button-acao bt_cinza'

        const iconeUrl = chrome.runtime.getURL("resources/prancheta.png")
        botao.innerHTML = `
          <img class="ui-button-icon-left ui-icon" src="${iconeUrl}">
          <span class="ui-button-text ui-c">Copiar Sinais Vitais</span>
        `
        botao.style.background = '#f4f4f4'
        botao.style.border = '1px solid #1c94c4'
        botao.style.color = '#1c94c4'
        botao.style.fontSize = '12px'
        botao.style.margin = '0 8px 0 0'
        botao.style.boxShadow = '1px 1px 3px 1px #ababab'

        botao.onclick = () => {
          const texto = extractSinaisVitais(doc)
          navigator.clipboard.writeText(texto).then(() => {
            botao.children[1].innerText = "Copiado!"
            setTimeout(() => botao.children[1].innerText = "Copiar Sinais Vitais", 2000)
          }).catch(() => {
            botao.innerText = "Erro ao copiar"
          })
        }

        botaoContainer.appendChild(botao)
      }
    } catch (e) {
      continue
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "copiar_sinais") {
    const iframes = document.querySelectorAll("iframe")
    for (const iframe of iframes) {
      try {
        const doc = iframe.contentWindow.document
        const head = doc.querySelector("#tabelaVisualizacaoRegistrosM_head")
        const body = doc.querySelector("#tabelaVisualizacaoRegistrosM_data")

        if (head && body) {
          const texto = extractSinaisVitais(doc)
          navigator.clipboard.writeText(texto).then(() => {
            sendResponse({ sucesso: true })
          }).catch(() => {
            sendResponse({ sucesso: false })
          })
          return true
        }
      } catch (_) {
        continue
      }
    }

    sendResponse({ sucesso: false })
    return true
  }
})

setInterval(tentarInjetar, 2000)
