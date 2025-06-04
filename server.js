const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index');
});

let jogadoresGlobais = {};

let salas = {};
let palavrasPorCategoria = {
  animais: ['jacaré', 'tigre', 'cachorro'],
  frutas: ['banana', 'maçã', 'laranja'],
  objetos: ['cadeira', 'espelho', 'garfo']
};

function escolherPalavraAleatoria() {
  const categorias = Object.keys(palavrasPorCategoria);
  const categoria = categorias[Math.floor(Math.random() * categorias.length)];
  const palavras = palavrasPorCategoria[categoria];
  const palavra = palavras[Math.floor(Math.random() * palavras.length)];
  return { palavra, categoria };
}

function gerarDicas(palavra) {
  return [
    `A palavra tem ${palavra.length} letras.`,
    `A primeira letra é "${palavra[0]}".`,
    `A última letra é "${palavra[palavra.length - 1]}".`
  ];
}

app.get('/validar-nome', (req, res) => {
  const nome = req.query.nome?.toLowerCase();
  if (!nome || jogadoresGlobais[nome]) {
    return res.json({ valido: false });
  }
  res.json({ valido: true });
});

io.on('connection', socket => {
  let nomeJogador = '';
  let salaAtual = '';

  socket.on('listarSalas', () => {
    const lista = Object.entries(salas).map(([id, s]) => ({
      id,
      nome: s.nome,
      jogadores: s.jogadores.length
    }));
    socket.emit('salasDisponiveis', lista);
  });

  socket.on('criarSala', nome => {
    nomeJogador = nome.toLowerCase();
    if (jogadoresGlobais[nomeJogador]) {
      socket.emit('erro', 'Nome já está em uso.');
      return;
    }
    const salaId = `sala_${Math.random().toString(36).substr(2, 5)}`;
    jogadoresGlobais[nomeJogador] = socket.id;

    salas[salaId] = {
      nome: `Sala de ${nome}`,
      jogadores: [],
      rodada: {
        numero: 1,
        palavra: '',
        categoria: '',
        dicas: [],
        reveladas: [],
        mensagens: 0
      },
      ranking: {}
    };

    salaAtual = salaId;
    salas[salaId].jogadores.push(nomeJogador);
    salas[salaId].ranking[nomeJogador] = { vitorias: 0, tentativas: 0, eliminado: false };
    socket.join(salaId);
    iniciarNovaRodada(salaId);
  });

  socket.on('entrarSala', ({ salaId, nome }) => {
    nomeJogador = nome.toLowerCase();
    if (jogadoresGlobais[nomeJogador]) {
      socket.emit('erro', 'Nome já está em uso.');
      return;
    }

    jogadoresGlobais[nomeJogador] = socket.id;
    salaAtual = salaId;
    salas[salaId].jogadores.push(nomeJogador);
    salas[salaId].ranking[nomeJogador] = { vitorias: 0, tentativas: 0, eliminado: false };
    socket.join(salaId);
    atualizarRanking(salaId);
  });

  socket.on('enviarMensagem', texto => {
    if (!salas[salaAtual] || salas[salaAtual].ranking[nomeJogador]?.eliminado) return;

    const rodada = salas[salaAtual].rodada;
    io.to(salaAtual).emit('mensagem', { nome: nomeJogador, texto });

    if (texto.toLowerCase() === rodada.palavra.toLowerCase()) {
      salas[salaAtual].ranking[nomeJogador].eliminado = true;
      io.to(socket.id).emit('eliminado', 'Você foi eliminado por dizer a palavra maldita no chat!');
      atualizarRanking(salaAtual);
      return;
    }

    rodada.mensagens += 1;
    revelarDica(salaAtual);
  });

  socket.on('tentarPalavra', tentativa => {
    const sala = salas[salaAtual];
    const rodada = sala.rodada;
    const jogador = sala.ranking[nomeJogador];

    if (jogador.eliminado) return;

    jogador.tentativas += 1;

    if (tentativa.toLowerCase() === rodada.palavra.toLowerCase()) {
      jogador.vitorias += 1;
      io.to(salaAtual).emit('mensagem', {
        nome: 'Sistema',
        texto: `${nomeJogador} acertou a palavra e venceu a rodada!`
      });
      iniciarNovaRodada(salaAtual);
    } else {
      if (tentativa.toLowerCase().includes(rodada.palavra.slice(0, 3))) {
        io.to(socket.id).emit('mensagemPrivada', 'Você chegou perto!');
      }

      if (jogador.tentativas >= 3) {
        jogador.eliminado = true;
        io.to(socket.id).emit('eliminado', 'Você foi eliminado após 3 tentativas erradas.');
      }
      atualizarRanking(salaAtual);
    }
  });

  socket.on('disconnect', () => {
    if (jogadoresGlobais[nomeJogador]) delete jogadoresGlobais[nomeJogador];
    if (salas[salaAtual]) {
      salas[salaAtual].jogadores = salas[salaAtual].jogadores.filter(j => j !== nomeJogador);
      delete salas[salaAtual].ranking[nomeJogador];
      atualizarRanking(salaAtual);
    }
  });

  function iniciarNovaRodada(salaId) {
    const sala = salas[salaId];
    const { palavra, categoria } = escolherPalavraAleatoria();
    sala.rodada = {
      numero: sala.rodada.numero + 1,
      palavra,
      categoria,
      dicas: gerarDicas(palavra),
      reveladas: [],
      mensagens: 0
    };

    for (const j of Object.keys(sala.ranking)) {
      sala.ranking[j].tentativas = 0;
      sala.ranking[j].eliminado = false;
    }

    io.to(salaId).emit('novaRodada', {
      rodada: sala.rodada.numero,
      categoria: categoria,
      dicas: []
    });

    atualizarRanking(salaId);
  }

  function revelarDica(salaId) {
    const sala = salas[salaId];
    const rodada = sala.rodada;
    const dicas = rodada.dicas;
    const reveladas = rodada.reveladas;

    const msgCount = rodada.mensagens;
    const maxDicas = dicas.length;

    if (msgCount <= maxDicas && !reveladas.includes(msgCount - 1)) {
      const nova = dicas[msgCount - 1];
      reveladas.push(msgCount - 1);
      io.to(salaId).emit('novaDica', nova);
    }
  }

  function atualizarRanking(salaId) {
    const sala = salas[salaId];
    const lista = Object.entries(sala.ranking).map(([nome, stats]) => ({
      nome,
      ...stats
    }));
    io.to(salaId).emit('atualizarRanking', lista);
  }
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
