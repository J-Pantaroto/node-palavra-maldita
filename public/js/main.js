const socket = io();

let nomeJogador = '';
let salaSelecionada = '';
let eliminado = false;

const nomeInput = document.getElementById('nomeInput');
const entrarBtn = document.getElementById('entrarNomeBtn');
const alertaBox = document.getElementById('alertaBox');

const telaNome = document.getElementById('telaNome');
const telaSalas = document.getElementById('telaSalas');
const telaJogo = document.getElementById('jogo');

const listaSalas = document.getElementById('listaSalas');
const criarSalaBtn = document.getElementById('criarSalaBtn');

const nomeSpan = document.getElementById('nomeJogador');
const chatBox = document.getElementById('chatBox');
const rankingLista = document.getElementById('rankingLista');
const dicaBox = document.getElementById('dicaBox');
const tentativasBox = document.createElement('div');
const vitoriasBox = document.createElement('div');
const rodadaBox = document.createElement('div');

chatBox.parentElement.insertBefore(rodadaBox, chatBox);
chatBox.parentElement.insertBefore(vitoriasBox, chatBox);
chatBox.parentElement.insertBefore(tentativasBox, chatBox);

// Valida nome
nomeInput.addEventListener('input', async () => {
  const nome = nomeInput.value.trim();
  if (nome.length < 3) {
    entrarBtn.disabled = true;
    alertaBox.innerText = 'Digite um nome válido';
    return;
  }

  const res = await fetch(`/validar-nome?nome=${encodeURIComponent(nome)}`);
  const data = await res.json();
  if (!data.valido) {
    alertaBox.innerText = 'Nome já está em uso';
    entrarBtn.disabled = true;
  } else {
    alertaBox.innerText = '';
    entrarBtn.disabled = false;
  }
});

entrarBtn.addEventListener('click', () => {
  nomeJogador = nomeInput.value.trim();
  nomeSpan.innerText = nomeJogador;
  socket.emit('listarSalas');
  telaNome.style.display = 'none';
  telaSalas.style.display = 'flex';
});

criarSalaBtn.addEventListener('click', () => {
  socket.emit('criarSala', nomeJogador);
  iniciarJogo();
});

socket.on('salasDisponiveis', salas => {
  listaSalas.innerHTML = '';
  salas.forEach(sala => {
    const card = document.createElement('div');
    card.className = 'sala-card';

    const info = document.createElement('div');
    info.className = 'sala-info';
    info.innerHTML = `<strong>${sala.nome}</strong><br>${sala.jogadores} jogador(es)`;

    const botao = document.createElement('button');
    botao.textContent = 'Entrar';
    botao.onclick = () => {
      socket.emit('entrarSala', { salaId: sala.id, nome: nomeJogador });
      iniciarJogo();
    };

    card.appendChild(info);
    card.appendChild(botao);
    listaSalas.appendChild(card);
  });
});

function iniciarJogo() {
  telaSalas.style.display = 'none';
  telaJogo.style.display = 'block';
}

document.getElementById('enviarMensagemBtn').addEventListener('click', () => {
  if (eliminado) return;
  const msg = document.getElementById('mensagemInput').value.trim();
  if (msg) {
    socket.emit('enviarMensagem', msg);
    document.getElementById('mensagemInput').value = '';
  }
});

document.getElementById('tentarBtn').addEventListener('click', () => {
  if (eliminado) return;
  const tentativa = document.getElementById('adivinharInput').value.trim();
  if (tentativa) {
    socket.emit('tentarPalavra', tentativa);
    document.getElementById('adivinharInput').value = '';
  }
});

socket.on('novaRodada', dados => {
  eliminado = false;
  rodadaBox.innerHTML = `<div class="dica"><svg height="14" width="14"><circle cx="7" cy="7" r="6" fill="#2980b9"/></svg> Rodada: <strong>${dados.rodada}</strong></div>`;
  dicaBox.innerHTML = '';
  setTimeout(() => {
    dicaBox.innerHTML += `<div class="dica">${dados.dicas[0]}</div>`;
  }, 1000);
  setTimeout(() => {
    dicaBox.innerHTML += `<div class="dica">${dados.dicas[1]}</div>`;
  }, 3000);
  setTimeout(() => {
    dicaBox.innerHTML += `<div class="dica">${dados.dicas[2]}</div>`;
  }, 5000);
});

// Atualizar ranking
socket.on('atualizarRanking', lista => {
  rankingLista.innerHTML = '';
  const jogador = lista.find(j => j.nome === nomeJogador);
  if (jogador) {
    vitoriasBox.innerHTML = `<div class="dica"><svg height="14" width="14"><circle cx="7" cy="7" r="6" fill="#27ae60"/></svg> Vitórias: <strong>${jogador.vitorias}</strong></div>`;
    tentativasBox.innerHTML = `<div class="alerta"><svg height="14" width="14"><circle cx="7" cy="7" r="6" fill="#e74c3c"/></svg> Tentativas: <strong>${jogador.tentativas}</strong></div>`;
  }
  lista.forEach(j => {
    const li = document.createElement('li');
    li.textContent = `${j.nome} - ${j.vitorias} vitórias`;
    if (j.eliminado) li.style.opacity = 0.5;
    rankingLista.appendChild(li);
  });
});

socket.on('mensagem', ({ nome, texto }) => {
  const msg = document.createElement('div');
  msg.innerHTML = `<strong>${nome}:</strong> ${texto}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('mensagemPrivada', msg => {
  const alerta = document.createElement('div');
  alerta.className = 'alerta';
  alerta.innerHTML = `<svg height="14" width="14"><circle cx="7" cy="7" r="6" fill="#f39c12"/></svg> ${msg}`;
  chatBox.appendChild(alerta);
});

socket.on('eliminado', msg => {
  eliminado = true;
  const alerta = document.createElement('div');
  alerta.className = 'alerta';
  alerta.innerHTML = `<svg height="14" width="14"><circle cx="7" cy="7" r="6" fill="#c0392b"/></svg> ${msg}`;
  chatBox.appendChild(alerta);
  document.getElementById('mensagemInput').disabled = true;
  document.getElementById('adivinharInput').disabled = true;
});

socket.on('erro', msg => {
  alertaBox.innerText = msg;
  telaNome.style.display = 'flex';
  telaSalas.style.display = 'none';
  telaJogo.style.display = 'none';
});
