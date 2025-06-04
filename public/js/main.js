const socket = io();

let nomeJogador = '';
let salaId = '';

const nomeInput = document.getElementById('nomeInput');
const entrarNomeBtn = document.getElementById('entrarNomeBtn');
const alertaBox = document.getElementById('alertaBox');

const telaNome = document.getElementById('telaNome');
const telaSalas = document.getElementById('telaSalas');
const telaJogo = document.getElementById('jogo');
const nomeJogadorSpan = document.getElementById('nomeJogador');

const listaSalas = document.getElementById('listaSalas');
const criarSalaBtn = document.getElementById('criarSalaBtn');

const chatBox = document.getElementById('chatBox');
const mensagemInput = document.getElementById('mensagemInput');
const enviarMensagemBtn = document.getElementById('enviarMensagemBtn');

const adivinharInput = document.getElementById('adivinharInput');
const tentarBtn = document.getElementById('tentarBtn');

const dicaBox = document.getElementById('dicaBox');
const rankingLista = document.getElementById('rankingLista');

nomeInput.addEventListener('input', async () => {
  const nome = nomeInput.value.trim().toLowerCase();
  if (!nome) {
    alertaBox.textContent = '';
    entrarNomeBtn.disabled = true;
    return;
  }

  const res = await fetch(`/validar-nome?nome=${nome}`);
  const data = await res.json();
  if (data.valido) {
    alertaBox.textContent = '';
    entrarNomeBtn.disabled = false;
  } else {
    alertaBox.textContent = 'Nome já está em uso!';
    entrarNomeBtn.disabled = true;
  }
});

entrarNomeBtn.addEventListener('click', () => {
  nomeJogador = nomeInput.value.trim();
  if (!nomeJogador) return;

  telaNome.style.display = 'none';
  telaSalas.style.display = 'flex';
  nomeJogadorSpan.textContent = nomeJogador;
  socket.emit('listarSalas');
});

criarSalaBtn.addEventListener('click', () => {
  socket.emit('criarSala', nomeJogador);
  telaSalas.style.display = 'none';
  telaJogo.style.display = 'block';
});

socket.on('salasDisponiveis', salas => {
  listaSalas.innerHTML = '';
  salas.forEach(s => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${s.nome} (${s.jogadores} jogadores)</span>
      <button onclick="entrarSala('${s.id}')">Entrar</button>
    `;
    listaSalas.appendChild(li);
  });
});

window.entrarSala = function (id) {
  salaId = id;
  socket.emit('entrarSala', { salaId: id, nome: nomeJogador });
  telaSalas.style.display = 'none';
  telaJogo.style.display = 'block';
};

enviarMensagemBtn.addEventListener('click', () => {
  const msg = mensagemInput.value.trim();
  if (msg) {
    socket.emit('enviarMensagem', msg);
    mensagemInput.value = '';
  }
});

socket.on('mensagem', ({ nome, texto }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${nome}:</strong> ${texto}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('mensagemPrivada', texto => {
  const div = document.createElement('div');
  div.classList.add('dica');
  div.innerHTML = `<strong>Sistema:</strong> ${texto}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

tentarBtn.addEventListener('click', () => {
  const tentativa = adivinharInput.value.trim();
  if (tentativa) {
    socket.emit('tentarPalavra', tentativa);
    adivinharInput.value = '';
  }
});

socket.on('atualizarRanking', ranking => {
  rankingLista.innerHTML = '';
  ranking.forEach(j => {
    const li = document.createElement('li');
    const status = j.eliminado ? 'N' : 'S';
    li.textContent = `${j.nome} - ${j.vitorias} vitórias, ${j.tentativas} tentativas ${status}`;
    rankingLista.appendChild(li);
  });
});

// Rodada
socket.on('novaRodada', ({ rodada, categoria }) => {
  chatBox.innerHTML = '';
  dicaBox.innerHTML = `Rodada ${rodada} - Categoria: <strong>${categoria}</strong>`;
  rankingLista.innerHTML = '';
  mensagemInput.disabled = false;
  adivinharInput.disabled = false;
  enviarMensagemBtn.disabled = false;
  tentarBtn.disabled = false;
});

// Dica
socket.on('novaDica', dica => {
  const novaLinha = document.createElement('div');
  novaLinha.classList.add('dica');
  novaLinha.innerHTML = dica;
  dicaBox.appendChild(novaLinha);
});

socket.on('eliminado', msg => {
  const alerta = document.createElement('div');
  alerta.classList.add('alerta');
  alerta.textContent = msg;
  chatBox.appendChild(alerta);
  chatBox.scrollTop = chatBox.scrollHeight;

  mensagemInput.disabled = true;
  adivinharInput.disabled = true;
  enviarMensagemBtn.disabled = true;
  tentarBtn.disabled = true;
});

socket.on('erro', msg => {
  alertaBox.textContent = msg;
});
