/* Dados do concurso — Edital nº 01/2026 (PMCG/IDECAN) e Retificação nº 05/2026 */
window.EDITAL = {
  prova: '2027-01-10T08:00:00-03:00',
  links: {
    edital: 'https://campinagrande.pb.gov.br/wp-content/uploads/2026/05/EDITAL-CAMPINA-GRANDE-GERAL_REVISAdo-1.pdf',
    retif5: 'https://dhg1h5j42swfq.cloudfront.net/2026/09/18000959/datas-campina-grande.pdf',
    decisao: 'https://marcelojose.com.br/2026/06/03/justica-constata-irregularidades-e-manda-prefeitura-de-cg-e-idecan-corrigirem-editais-de-concurso-publico/'
  },
  ficha: [
    ['Órgão', 'Prefeitura Municipal de Campina Grande/PB — Secretaria Municipal de Educação (SEDUC)'],
    ['Edital', 'Nº 01/2026, de 9 de maio de 2026, com retificações'],
    ['Banca', 'IDECAN'],
    ['Cargo', 'Assistente Social Educacional (nível superior)'],
    ['Requisitos', 'Graduação em Serviço Social reconhecida pelo MEC e registro ativo no CRESS'],
    ['Remuneração', 'R$ 4.272,07'],
    ['Jornada', '30 horas semanais'],
    ['Vagas', '25 — 19 ampla concorrência, 3 PcD e 3 pessoas negras (Retificação nº 05/2026)'],
    ['Etapas', 'Prova objetiva (eliminatória e classificatória) e prova de títulos (classificatória)'],
    ['Prova objetiva', 'Domingo, 10/01/2027, turno da manhã, em Campina Grande — 3 horas de duração'],
    ['Locais de prova', 'Divulgação prevista para 30/12/2026']
  ],
  composicao: [
    ['Conhecimentos Gerais', 'Língua Portuguesa', 10, '1,00', '10,00', false],
    ['Conhecimentos Gerais', 'Noções de Informática', 5, '1,00', '5,00', false],
    ['Conhecimentos Gerais', 'História de Campina Grande/PB', 3, '1,00*', '3,00', true],
    ['Conhecimentos Gerais', 'Legislação e Ética no Serviço Público', 3, '1,00', '3,00', true],
    ['Conhecimentos Específicos', 'Conhecimentos específicos ao cargo', 20, '2,00', '40,00', true]
  ],
  criterios: [
    'Mínimo de 50% da pontuação máxima da prova objetiva (30 dos 60 pontos).',
    'Mínimo de 1,00 ponto em cada disciplina de Conhecimentos Gerais.',
    'Mínimo de 2,00 pontos em Conhecimentos Específicos.',
    'Cada questão tem 4 alternativas (A, B, C e D), apenas uma correta; não há desconto por erro.',
    'Legislação com entrada em vigor após a publicação do edital não será objeto de avaliação.',
    'Candidato não aprovado na prova objetiva é eliminado e não tem classificação.'
  ],
  desempate: [
    'Idade igual ou superior a 60 anos (Estatuto da Pessoa Idosa, art. 27, parágrafo único).',
    'Maior pontuação em Conhecimentos Específicos.',
    'Maior pontuação em Língua Portuguesa.',
    'Maior pontuação em Legislação e Ética no Serviço Público.',
    'Maior pontuação em Noções de Informática.'
  ],
  titulos: [
    ['Especialização lato sensu (mínimo de 360 h), na área a que concorre ou na educação', '0,50', '1,00'],
    ['Mestrado, na área a que concorre ou na educação', '2,00', '2,00'],
    ['Doutorado, na área a que concorre ou na educação', '3,00', '3,00'],
    ['Experiência profissional de nível superior, pública ou privada, na área ou na educação', '0,50 por semestre completo', '4,00'],
    ['Total', '', '10,00']
  ],
  cronograma: [
    ['27/10/2026', 'Resultado definitivo das inscrições (PcD, pessoas negras e atendimento especial)'],
    ['30/12/2026', 'Divulgação dos locais de prova'],
    ['10/01/2027', 'Prova objetiva — domingo, manhã'],
    ['11/01/2027', 'Gabarito preliminar'],
    ['12 e 13/01/2027', 'Recursos contra o gabarito preliminar'],
    ['01/02/2027', 'Gabarito definitivo e resultado preliminar da prova objetiva'],
    ['24/02/2027', 'Resultado definitivo da prova objetiva'],
    ['26/02/2027', 'Convocação para a prova de títulos (38 AC, 6 PcD, 38 pessoas negras)'],
    ['01 a 03/03/2027', 'Envio dos títulos'],
    ['01/04/2027', 'Resultado definitivo da prova de títulos']
  ],
  /* Conteúdo programático específico, dividido em itens e associado aos tópicos da plataforma */
  conteudo: [
    ['Fundamentos históricos e teórico-metodológicos do Serviço Social. O projeto ético-político do Serviço Social: construção e desafios.', ['fund']],
    ['Fundamentos éticos, ética profissional e legislação específica: Lei nº 8.662/1993, Código de Ética Profissional (Resolução CFESS nº 273/1993).', ['etica']],
    ['Dimensão técnico-operativa do Serviço Social no contexto educacional: instrumentos e técnicas; entrevista, visita domiciliar, estudo social, laudo e relatório social; atuação em equipe multiprofissional e interdisciplinar.', ['tecop']],
    ['Questão social e direitos de cidadania; política social; seguridade social no Brasil. Políticas de educação, saúde e assistência social e respectivas legislações.', ['fund', 'seg']],
    ['Sistema Único de Assistência Social (SUAS); PNAS/2004; CRAS, CREAS; BPC/LOAS (Lei nº 8.742/1993).', ['seg']],
    ['Serviço Social na Educação: o papel do assistente social nas unidades escolares; trabalho com famílias e comunidade; articulação em rede; acompanhamento de alunos em situação de vulnerabilidade social; combate ao trabalho infantil e à evasão escolar; proteção à criança e ao adolescente.', ['ssedu']],
    ['Estatuto da Criança e do Adolescente (ECA – Lei nº 8.069/1990); Lei Maria da Penha (Lei nº 11.340/2006); Estatuto da Pessoa Idosa (Lei nº 10.741/2003, com redação dada pela Lei nº 14.423/2022); Estatuto da Pessoa com Deficiência (Lei nº 13.146/2015).', ['direitos']],
    ['Políticas e programas sociais dirigidos à criança, ao adolescente, à família e à pessoa idosa. Intersetorialidade das políticas sociais. Indicadores sociais; elaboração de laudos, pareceres e relatórios sociais.', ['seg', 'tecop']],
    ['Legislação e políticas educacionais: Constituição Federal de 1988, arts. 205 a 214; Lei nº 9.394/1996 (LDB); Estatuto da Criança e do Adolescente; Plano Nacional de Educação vigente (Lei nº 15.388/2026); Lei nº 14.113/2020 (FUNDEB); Base Nacional Comum Curricular; Diretrizes Curriculares Nacionais; Projeto Político-Pedagógico; gestão democrática; planejamento educacional; currículo, avaliação e recuperação da aprendizagem.', ['poledu']],
    ['Educação inclusiva, educação especial, acessibilidade e atendimento educacional especializado; diversidade, direitos humanos, relações étnico-raciais, história e cultura afro-brasileira, africana e indígena; tecnologias educacionais, metodologias ativas, interdisciplinaridade e relação escola-família-comunidade.', ['poledu', 'ssedu']],
    ['Eixo comum de Assistência Social e Proteção Social: Seguridade social; LOAS; PNAS; SUAS; NOB/SUAS; Tipificação Nacional dos Serviços Socioassistenciais; proteção social básica e especial; CRAS, CREAS, PAIF e PAEFI; BPC; Cadastro Único; trabalho social com famílias; rede socioassistencial; vulnerabilidade e risco social; intersetorialidade; direitos da criança e do adolescente, da pessoa idosa, da mulher e da pessoa com deficiência; elaboração de relatórios, pareceres, registros técnicos e trabalho em equipe multiprofissional.', ['seg', 'direitos', 'tecop']]
  ],
  gerais: [
    ['Legislação e Ética no Serviço Público', 'Lei Orgânica do Município de Campina Grande; LGPD (Lei 13.709/2018); LAI (Lei 12.527/2011); ética no serviço público; ética e moral; valores, virtude, honestidade, integridade, decoro e zelo; princípios da Administração Pública (LIMPE).', 'Parcial — LGPD, LAI, ética e LIMPE (sem a Lei Orgânica)'],
    ['História de Campina Grande/PB', 'História geral sobre o município de Campina Grande, na Paraíba.', 'Marcos essenciais'],
    ['Língua Portuguesa', 'Conforme Anexo II do edital.', 'Não incluído'],
    ['Noções de Informática', 'Conforme Anexo II do edital.', 'Não incluído']
  ]
};
