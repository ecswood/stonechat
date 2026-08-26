const messages = {
  pt: {
    translations: {
      selectLanguage: "Selecione um idioma",
      signup: {
        title: "Cadastre-se",
        toasts: {
          success: "Usuário criado com sucesso! Faça seu login!!!.",
          fail: "Erro ao criar usuário. Verifique os dados informados.",
        },
        form: {
          name: "Nome da empresa",
          email: "Email",
          phone: "Telefone com (DDD)",
          plan: "Plano",
          password: "Senha",
        },
        formErrors: {
          name: {
            required: "Nome da empresa é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          password: {
            short: "Senha muito curta",
            long: "Senha muito longa",
          },
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
        },
        buttons: {
          submit: "Cadastrar",
          login: "Já tem uma conta? Entre!",
        },
        plan: {
          attendant: "Atendente",
          whatsapp: "WhatsApp",
          queues: "Setores",
        },
      },
      login: {
        title: "Login",
        form: {
          email: "Email",
          password: "Senha",
        },
        buttons: {
          submit: "Entrar",
          register: "Registre-se, agora mesmo!",
        },
      },
      resetPassword: {
        title: "Redefinir Senha",
        toasts: {
          emailSent: "Email enviado com sucesso!",
          emailNotFound: "Email não encontrado!",
          passwordUpdated: "Senha atualizada com sucesso!",
        },
        formErrors: {
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
          newPassword: {
            required: "Nova senha é obrigatória",
            matches:
                "Sua senha precisa ter no mínimo 8 caracteres, sendo uma letra maiúscula, uma minúscula e um número.",
          },
          confirmPassword: {
            required: "Confirmação de senha é obrigatória",
            matches: "As senhas não correspondem",
          },
        },
        form: {
          email: "Email",
          verificationCode: "Código de verificação",
          newPassword: "Nova senha",
          confirmPassword: "Confirme a nova senha",
        },
        buttons: {
          submitEmail: "Enviar email",
          submitPassword: "Redefinir senha",
          back: "Não tem uma conta? Cadastre-se!",
        },
      },
      dashboard: {
        toasts: {
          selectFilterError: "Parametrize o filtro",
          userChartError: "Erro ao obter informações da conversa",
          dateChartError: "Erro ao obter informações da conversa",
        },
        filters: {
          initialDate: "Data Inicial",
          finalDate: "Data Final",
          filterType: {
            title: "Tipo de Filtro",
            options: {
              perDate: "Filtro por Data",
              perPeriod: "Filtro por Período",
            },
            helper: "Selecione o tipo de filtro desejado",
          },
        },
        periodSelect: {
          title: "Período",
          options: {
            none: "Nenhum selecionado",
            last3: "Últimos 3 dias",
            last7: "Últimos 7 dias",
            last15: "Últimos 15 dias",
            last30: "Últimos 30 dias",
            last60: "Últimos 60 dias",
            last90: "Últimos 90 dias",
          },
          helper: "Selecione o período desejado",
        },
        counters: {
          inTalk: "Em conversa",
          waiting: "Aguardando",
          finished: "Finalizados",
          newContacts: "Novos contatos",
          averageTalkTime: "T.M. de Conversa",
          averageWaitTime: "T.M. de Espera",
        },
        buttons: {
          filter: "Filtrar",
        },
        onlineTable: {
          ratingLabel: "1 - Insatisfeito, 2 - Satisfeito, 3 - Muito Satisfeito",
          name: "Nome",
          ratings: "Avaliações",
          avgSupportTime: "T.M. de Atendimento",
          status: "Status (Atual)",
        },
        charts: {
          user: {
            label: "Gráfico de Conversas",
            title: "Total de Conversas por Usuários",
            start: "Início",
            end: "Fim",
            filter: "Filtrar",
          },
          date: {
            label: "Gráfico de Conversas",
            title: "Total",
            start: "Início",
            end: "Fim",
            filter: "Filtrar",
          },
        },
      },
      plans: {
        toasts: {
          errorList: "Não foi possível carregar a lista de registros",
          errorOperation: "Não foi possível realizar a operação",
          error:
              "Não foi possível realizar a operação. Verifique se já existe uma plano com o mesmo nome ou se os campos foram preenchidos corretamente",
          success: "Operação realizada com sucesso!",
        },
        confirm: {
          title: "Exclusão de Registro",
          message: "Deseja realmente excluir o registro?",
        },
        form: {
          name: "Nome",
          users: "Usuários",
          connections: "Conexões",
          queues: "Setores",
          value: "Valor",
          internalChat: "Chat Interno",
          externalApi: "API Externa",
          kanban: "Kanban",
          integrations: "Integrações",
          campaigns: "Campanhas",
          schedules: "Agendamentos",
          enabled: "Habilitadas",
          disabled: "Desabilitadas",
          clear: "Cancelar",
          delete: "Excluir",
          save: "Salvar",
          yes: "Sim",
          no: "Não",
          money: "R$",
        },
      },
      kanban: {
        toasts: {
          removed: "Ticket Tag Removido!",
          added: "Ticket Tag Adicionado com Sucesso!",
        },
        open: "Em aberto",
        seeTicket: "Ver Ticket",
      },
      ticketsPipeline: {
        ia: "IA",
        aguardando: "Aguardando",
        atendendo: "Atendendo",
        pull: "Atender",
        aiTag: "Atendimento IA",
        seeTicket: "Ver Ticket",
      },
      linkedContacts: {
        banner: "Este CPF também está associado a: ",
      },
      invoices: {
        title: "Faturas",
        paid: "Pago",
        open: "Em Aberto",
        expired: "Vencido",
        details: "Detalhes",
        value: "Valor",
        dueDate: "Data Venc.",
        status: "Status",
        action: "Ação",
        PAY: "PAGAR",
        PAID: "PAGO",
      },
      checkoutPage: {
        steps: {
          data: "Dados",
          customize: "Personalizar",
          review: "Revisar",
        },
        success:
            "Assinatura realizada com sucesso!, aguardando a realização do pagamento",
        closeToEnd: "Falta pouco!",
        BACK: "VOLTAR",
        PAY: "PAGAR",
        NEXT: "PRÓXIMO",
        review: {
          title: "Resumo da assinatura",
          details: "Detalhes do plano",
          users: "Usuários",
          whatsapp: "Whatsapp",
          charges: "Cobrança: Mensal",
          total: "Total",
        },
        form: {
          firstName: {
            label: "Nome completo*",
            required: "Nome completo é obrigatório",
          },
          lastName: {
            label: "Sobrenome*",
            required: "Sobrenome é obrigatório",
          },
          address1: {
            label: "Endereço*",
            required: "Endereço é obrigatório",
          },
          city: {
            label: "Cidade*",
            required: "Cidade é obrigatório",
          },
          state: {
            label: "Estado*",
            required: "Estado é obrigatório",
          },
          zipcode: {
            label: "CEP*",
            required: "CEP é obrigatório",
            invalid: "Formato de CEP inválido",
          },
          country: {
            label: "País*",
            required: "País é obrigatório",
          },
          useAddressForPaymentDetails: {
            label: "Use este endereço para os detalhes de pagamento",
          },
          invoiceId: {
            label: "Use este invoiceId",
          },
          nameOnCard: {
            label: "Nome no cartão*",
            required: "Nome no cartão é obrigatório",
          },
          cardNumber: {
            label: "Número do cartão*",
            required: "Número do cartão é obrigatório",
            invalid: "Número do cartão inválido (ex: 4111111111111)",
          },
          expiryDate: {
            label: "Data de validade*",
            required: "Data de validade é obrigatória",
            invalid: "Data de validade inválida"
          },
          cvv: {
            label: "CVV*",
            required: "CVV é obrigatório",
            invalid: "CVV inválido (ex: 123)",
          },
        },
        pricing: {
          users: "Usuários",
          connection: "Conexão",
          queues: "Setores",
          SELECT: "SELECIONAR",
          month: "mês",
        },
      },
      companies: {
        title: "Cadastrar Empresa",
        form: {
          name: "Nome da Empresa",
          plan: "Plano",
          token: "Token",
          submit: "Cadastrar",
          success: "Empresa criada com sucesso!",
        },
      },
      auth: {
        toasts: {
          success: "Login efetuado com sucesso!",
        },
        token: "Token",
      },
      connections: {
        title: "Conexões",
        toasts: {
          deleted: "Conexão com o WhatsApp excluída com sucesso!",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida.",
          disconnectTitle: "Desconectar",
          disconnectMessage:
              "Tem certeza? Você precisará ler o QR Code novamente.",
        },
        buttons: {
          add: "Adicionar WhatsApp",
          disconnect: "desconectar",
          tryAgain: "Tentar novamente",
          qrcode: "QR CODE",
          newQr: "Novo QR CODE",
          connecting: "Conectando",
        },
        toolTips: {
          disconnected: {
            title: "Falha ao iniciar sessão do WhatsApp",
            content:
                "Certifique-se de que seu celular esteja conectado à internet e tente novamente, ou solicite um novo QR Code",
          },
          qrcode: {
            title: "Esperando leitura do QR Code",
            content:
                "Clique no botão 'QR CODE' e leia o QR Code com o seu celular para iniciar a sessão",
          },
          connected: {
            title: "Conexão estabelecida!",
          },
          timeout: {
            title: "A conexão com o celular foi perdida",
            content:
                "Certifique-se de que seu celular esteja conectado à internet e o WhatsApp esteja aberto, ou clique no botão 'Desconectar' para obter um novo QR Code",
          },
        },
        table: {
          name: "Nome",
          status: "Status",
          lastUpdate: "Última atualização",
          default: "Padrão",
          actions: "Ações",
          session: "Sessão",
        },
      },
      whatsappModal: {
        title: {
          add: "Adicionar WhatsApp",
          edit: "Editar WhatsApp",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
        },
        tabs: {
          general: "Geral",
          messages: "Mensagens",
          assessments: "Avaliações",
          integrations: "Integrações",
          schedules: "Horário de expediente",
        },
        form: {
          name: "Nome",
          default: "Padrão",
          sendIdQueue: "Setor",
          timeSendQueue: "Redirecionar para setor em X minutos",
          queueRedirection: "Redirecionamento de Setor",
          outOfHoursMessage: "Mensagem de fora de expediente",
          queueRedirectionDesc:
              "Selecione um setor para os contatos que não possuem setor serem redirecionados",
          prompt: "Prompt",
          queue: "Setor de Transferência",
          timeToTransfer: "Transferir após x (minutos)",
          //maxUseBotQueues: "Enviar bot x vezes",
          //timeUseBotQueues: "Intervalo em minutos entre envio de bot",
          expiresTicket: "Encerrar chats abertos após x minutos",
          expiresInactiveMessage: "Mensagem de encerramento por inatividade",
          greetingMessage: "Mensagem de saudação",
          complationMessage: "Mensagem de conclusão",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "WhatsApp salvo com sucesso.",
      },
      qrCodeModal: {
        title: "Utilize o seu WhatsApp:",
        steps: {
          one: "1 - Abra o WhatsApp no seu celular",
          two: {
            partOne: "2 - Toque em Mais opções no Android",
            partTwo: "ou em Configurações",
            partThree: "no iPhone",
          },
          three:
              "3 - Toque em Dispositivos conectados e, em seguida, em Conectar dispositivos",
          four: "4 - Aponte seu celular para essa tela para capturar o QR Code",
        },
        waiting: "Aguardando leitura do QR Code",
      },
      qrCode: {
        message: "Leia o QrCode para iniciar a sessão",
      },
      contacts: {
        title: "Contatos",
        toasts: {
          deleted: "Contato excluído com sucesso!",
          deletedAll: "Todos contatos excluídos com sucesso!",
        },
        searchPlaceholder: "Pesquisar...",
        confirmationModal: {
          deleteTitle: "Deletar ",
          deleteAllTitle: "Deletar Todos",
          importTitle: "Importar contatos",
          deleteMessage:
              "Tem certeza que deseja deletar este contato? Todos os tickets relacionados serão perdidos.",
          deleteAllMessage:
              "Tem certeza que deseja deletar todos os contatos? Todos os tickets relacionados serão perdidos.",
          importMessage: "Deseja importar todos os contatos do telefone?",
        },
        buttons: {
          import: "Importar Contatos",
          add: "Adicionar Contato",
          export: "Exportar Contatos",
          delete: "Excluir Todos Contatos",
        },
        table: {
          name: "Nome",
          whatsapp: "WhatsApp",
          email: "Email",
          actions: "Ações",
        },
      },
      contactImportModal: {
        title: "Planílha de contatos",
        labels: {
          import: "Importar contatos",
          result: "resultados",
          added: "Adicionados",
          savedContact: "Contato salvo",
          errors: "Erros",
        },
        buttons: {
          download: "Baixar planílha modelo",
          import: "Importar contatos",
        },
      },
      queueIntegrationModal: {
        title: {
          add: "Adicionar projeto",
          edit: "Editar projeto",
        },
        form: {
          id: "ID",
          type: "Tipo",
          name: "Nome",
          projectName: "Nome do Projeto",
          language: "Linguagem",
          jsonContent: "JsonContent",
          urlN8N: "URL",
          typebotSlug: "Typebot - Slug",
          typebotExpires: "Tempo em minutos para expirar uma conversa",
          typebotKeywordFinish: "Palavra para finalizar o ticket",
          typebotKeywordRestart: "Palavra para reiniciar o fluxo",
          typebotRestartMessage: "Mensagem ao reiniciar a conversa",
          typebotUnknownMessage: "Mensagem de opção inválida",
          typebotDelayMessage: "Intervalo (ms) entre mensagens",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
          test: "Testar Bot",
        },
        messages: {
          testSuccess: "Integração testada com sucesso!",
          addSuccess: "Integração adicionada com sucesso.",
          editSuccess: "Integração editada com sucesso.",
        },
      },
      sideMenu: {
        name: "Menu Lateral Inicial",
        note: "Se habilitado, o menu lateral irá iniciar fechado",
        options: {
          enabled: "Aberto",
          disabled: "Fechado",
        },
      },
      promptModal: {
        form: {
          name: "Nome",
          prompt: "Prompt",
          model: "Modelo",
          max_tokens: "Máximo de Tokens na resposta",
          temperature: "Temperatura",
          apikey: "API Key",
          max_messages: "Máximo de mensagens no Histórico",
          systemTemplate: "Template avançado do prompt de sistema (opcional)",
          systemTemplateHelp:
            "Controla saudação, fluxo técnico e as frases de Ação que a IA usa pra buscar boleto/bloqueio/etc de verdade no SGP. Deixe em branco pra usar o padrão. Se for editar: as frases entre aspas simples (ex: 'Ação: Buscar Boleto') têm que continuar exatamente assim em algum lugar do texto — apagar ou reescrever uma delas faz a IA parar de consultar o sistema real e passar a inventar respostas.",
          restoreDefaultTemplate: "Restaurar padrão",
          restoreDefaultTemplateConfirm:
            "Isso substitui o texto atual deste campo pelo padrão do sistema. Continuar?",
        },
        formErrors: {
          name: {
            short: "Nome muito curto",
            long: "Nome muito longo",
            required: "Nome é obrigatório",
          },
          prompt: {
            short: "Prompt muito curto",
            required: "Descreva o treinamento para Inteligência Artificial",
          },
          modal: {
            required: "Informe o modelo desejado para o Prompt",
          },
          maxTokens: {
            required: "Informe o número máximo de tokens na resposta",
          },
          temperature: {
            required: "Informe a temperatura",
          },
          apikey: {
            required: "Informe a API Key",
          },
          queueId: {
            required: "Informe o setor",
          },
          maxMessages: {
            required: "Informe o número máximo de mensagens no histórico",
          },
        },
        success: "Prompt salvo com sucesso!",
        setor: "Informe o setor",
        title: {
          add: "Adicionar Prompt",
          edit: "Editar Prompt",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
      },
      prompts: {
        title: "Prompts",
        table: {
          name: "Nome",
          queue: "Setor",
          max_tokens: "Máximo Tokens Resposta",
          actions: "Ações",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida!",
        },
        buttons: {
          add: "Adicionar Prompt",
        },
      },
      contactModal: {
        title: {
          add: "Adicionar contato",
          edit: "Editar contato",
        },
        form: {
          mainInfo: "Dados do contato",
          extraInfo: "Informações adicionais",
          name: "Nome",
          number: "Número do Whatsapp",
          email: "Email",
          extraName: "Nome do campo",
          extraValue: "Valor",
          whatsapp: "Conexão Origem: ",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          phone: {
            short: "Número muito curto",
            long: "Número muito longo",
          },
          email: {
            invalid: "Email inválido",
          },
        },
        buttons: {
          addExtraInfo: "Adicionar informação",
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Contato salvo com sucesso.",
      },
      queueModal: {
        title: {
          add: "Adicionar setor",
          edit: "Editar setor",
        },
        form: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          color: "Cor",
          colorShort: "Cor curta",
          colorLong: "Cor longa",
          greetingMessage: "Mensagem de saudação",
          complationMessage: "Mensagem de conclusão",
          outOfHoursMessage: "Mensagem de fora de expediente",
          ratingMessage: "Mensagem de avaliação",
          token: "Token",
          orderQueue: "Ordem do setor (Bot)",
          integrationId: "Integração",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        toasts: {
          success: "Setor salvo com sucesso.",
          info: "Clique em salvar para registar as alterações",
        },
        tabs: {
          queueData: "Dados do setor",
          attendanceTime: "Horários de Atendimento",
        },
      },
      userModal: {
        title: {
          add: "Adicionar usuário",
          edit: "Editar usuário",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
          profile: "Perfil",
          whatsapp: "Conexão Padrão",

          allTicket: "Ticket Sem Setor [Invisível]",
          allTicketEnabled: "Habilitado",
          allTicketDesabled: "Desabilitado",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
            long: "Nome muito longo",
          },
          password: {
            short: "Senha muito curta",
            long: "Senha muito longa",
          },
          email: {
            required: "Email é obrigatório",
            invalid: "Email inválido",
          },
        },
        labels: {
          liberations: "Liberações",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Usuário salvo com sucesso.",
      },
      scheduleModal: {
        title: {
          add: "Novo Agendamento",
          edit: "Editar Agendamento",
        },
        form: {
          body: "Mensagem",
          contact: "Contato",
          sendAt: "Data de Agendamento",
          sentAt: "Data de Envio",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Agendamento salvo com sucesso.",
      },
      tagModal: {
        title: {
          add: "Nova Tag",
          edit: "Editar Tag",
        },
        form: {
          name: "Nome",
          color: "Cor",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Tag salvo com sucesso.",
      },
      chat: {
        toasts: {
          fillTitle: "Por favor, preencha o título da conversa.",
          fillUser: "Por favor, selecione pelo menos um usuário.",
        },
        modal: {
          title: "Conversa",
          titleField: "Título",
        },
        confirm: {
          title: "Excluir Conversa",
          message: "Esta ação não pode ser revertida, confirmar?",
        },
        chats: "Chats",
        messages: "Mensagens",
        noTicketMessage: "Selecione um ticket para começar a conversar.",
        buttons: {
          close: "Fechar",
          save: "Salvar",
          new: "Nova",
          newChat: "Novo",
        },
      },
      uploads: {
        titles: {
          titleUploadMsgDragDrop: "ARRASTE E SOLTE ARQUIVOS NO CAMPO ABAIXO",
          titleFileList: "Lista de arquivo(s)",
        },
      },
      ticketsManager: {
        buttons: {
          newTicket: "Novo",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Setores",
      },
      tickets: {
        toasts: {
          deleted: "O atendimento que você estava foi deletado.",
          unauthorized: "Acesso não permitido",
        },
        filters: {
          user: "Filtro por usuários",
          tags: "Filtro por tags",
        },
        notification: {
          message: "Mensagem de",
        },
        tabs: {
          open: { title: "Abertas" },
          closed: { title: "Resolvidos" },
          search: { title: "Busca" },
        },
        search: {
          placeholder: "Buscar atendimento e mensagens",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Ticket",
        fieldLabel: "Digite para buscar usuários",
        fieldUserLabel: "Atendente",
        fieldQueueLabel: "Transferir para setor",
        fieldQueuePlaceholder: "Selecione um setor",
        noOptions: "Nenhum usuário encontrado com esse nome",
        noUserSelected: "Nenhum atendente específico",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
        },
      },
      ticketsList: {
        pendingHeader: "Aguardando",
        assignedHeader: "Atendendo",
        noTicketsTitle: "Nada aqui!",
        noTicketsMessage:
            "Nenhum atendimento encontrado com esse status ou termo pesquisado",
        buttons: {
          accept: "Aceitar",
          closed: "Finalizar",
          reopen: "Reabrir",
        },
      },
      ticketsListItem: {
        tooltip: {
          chatbot: "Chatbot",
          peek: "Espiar Conversa",
        },
        noQueue: "SEM SETOR",
      },
      ticketAdvanced: {
        selectTicket: "Selecionar Ticket",
        ticketNav: "Ticket",
        attendanceNav: "Atendimentos",
      },
      newTicketModal: {
        title: "Criar Ticket",
        fieldLabel: "Digite para pesquisar o contato",
        add: "Adicionar",
        searchQueueError:
            "Ocorreu um erro inesperado ao tentar buscar os setores",
        selectQueue: "Selecione um setor",
        selectConection: "Selecione uma conexão",
        buttons: {
          ok: "Salvar",
          cancel: "Cancelar",
        },
      },
      locationPreview: {
        button: "Visualizar",
      },
      mainDrawer: {
        listItems: {
          dashboard: "Dashboard",
          connections: "Conexões",
          tickets: "Atendimentos",
          quickMessages: "Respostas Rápidas",
          tasks: "Tarefas",
          contacts: "Contatos",
          queues: "Setores & Chatbot",
          tags: "Tags",
          administration: "Administração",
          users: "Usuários",
          ratings: "Avaliações",
          settings: "Configurações",
          helps: "Ajuda",
          messagesAPI: "API",
          schedules: "Agendamentos",
          campaigns: "Campanhas",
          annoucements: "Informativos",
          chats: "Chat Interno",
          financeiro: "Financeiro",
          files: "Lista de arquivos",
          prompts: "Open.Ai",
          queueIntegration: "Integrações",
        },
        appBar: {
          refresh: "Recarregar página",
          notRegister: "Sem notificações",
          greeting: {
						hello: "Olá",
						welcome: "Bem vindo a",
						active: "Ativo até",
					},
          user: {
            profile: "Perfil",
            logout: "Sair",
          },
        },
      },
      queueIntegration: {
        title: "Integrações",
        table: {
          id: "ID",
          type: "Tipo",
          name: "Nome",
          projectName: "Nome do Projeto",
          language: "Linguagem",
          lastUpdate: "Ultima atualização",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar Projeto",
        },
        searchPlaceholder: "Pesquisar...",
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Você tem certeza? Essa ação não pode ser revertida! e será removida dos setores e conexões vinculadas",
        },
      },
      files: {
        title: "Lista de arquivos",
        table: {
          name: "Nome",
          contacts: "Contatos",
          actions: "Ação",
        },
        toasts: {
          deleted: "Lista excluída com sucesso!",
          deletedAll: "Todas as listas foram excluídas com sucesso!",
        },
        buttons: {
          add: "Adicionar",
          deleteAll: "Deletar Todos",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteAllTitle: "Deletar Todos",
          deleteMessage: "Tem certeza que deseja deletar esta lista?",
          deleteAllMessage: "Tem certeza que deseja deletar todas as listas?",
        },
      },
      messagesAPI: {
        title: "API",
        labels: {
          doc: "Documentação para envio de mensagens",
          method: "Métodos de Envio",
          textMessage: "Mensagem de Texto",
          mediaMessage: "Mensagem de Mídia",
          instructions: "Instruções",
          observations: "Observações importantes",
          before1:
              "Antes de enviar mensagens, é necessário o cadastro do token vinculado à conexão que enviará as mensagens.",
          before2:
              "Para realizar o cadastro acesse o menu 'Conexões', clique no botão editar da conexão e insira o token no devido campo.",
          numberDescription:
              "O número para envio não deve ter mascara ou caracteres especiais e deve ser composto por:",
          countryCode: "Código do País",
          number: "Número",
          textMessage2: "1. Mensagens de Texto",
          textMessageInstructions:
              "Seguem abaixo a lista de informações necessárias para envio das mensagens de texto:",
          method2: "Método",
          e: "e",
          tests: "Teste de Envio",
          mediaMessage2: "2. Mensagens de Mídia",
        },
        textMessage: {
          number: "Número",
          body: "Mensagem",
          token: "Token cadastrado",
        },
        mediaMessage: {
          number: "Número",
          body: "Nome do arquivo",
          media: "Arquivo",
          token: "Token cadastrado",
        },
        toasts: {
          unauthorized:
              "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.",
          success: "Mensagem enviada com sucesso!",
        },
        buttons: {
          send: "Enviar",
        },
      },
      notifications: {
        noTickets: "Nenhuma notificação.",
      },
      quickMessages: {
        title: "Respostas Rápidas",
        searchPlaceholder: "Pesquisar...",
        noAttachment: "Sem anexo",
        confirmationModal: {
          deleteTitle: "Exclusão",
          deleteMessage: "Esta ação é irreversível! Deseja prosseguir?",
        },
        buttons: {
          add: "Adicionar",
          attach: "Anexar Arquivo",
          cancel: "Cancelar",
          edit: "Editar",
        },
        toasts: {
          success: "Atalho adicionado com sucesso!",
          deleted: "Atalho removido com sucesso!",
        },
        dialog: {
          title: "Mensagem Rápida",
          shortcode: "Atalho",
          message: "Resposta",
          save: "Salvar",
          cancel: "Cancelar",
          geral: "Permitir editar",
          add: "Adicionar",
          edit: "Editar",
          visao: "Permitir visão",
        },
        table: {
          shortcode: "Atalho",
          message: "Mensagem",
          actions: "Ações",
          mediaName: "Nome do Arquivo",
          status: "Status",
        },
      },
      messageVariablesPicker: {
        label: "Variavéis disponíveis",
        vars: {
          contactFirstName: "Primeiro Nome",
          contactName: "Nome",
          greeting: "Saudação",
          protocolNumber: "Protocolo",
          date: "Data",
          hour: "Hora",
        },
      },
      contactLists: {
        title: "Listas de Contatos",
        table: {
          name: "Nome",
          contacts: "Contatos",
          actions: "Ações",
        },
        buttons: {
          add: "Nova Lista",
        },
        dialog: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          company: "Empresa",
          okEdit: "Editar",
          okAdd: "Adicionar",
          add: "Adicionar",
          edit: "Editar",
          cancel: "Cancelar",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          deleted: "Registro excluído",
          success: "Operação realizada com sucesso",
        },
      },
      contactListItems: {
        title: "Contatos",
        searchPlaceholder: "Pesquisa",
        buttons: {
          add: "Novo",
          lists: "Listas",
          import: "Importar",
        },
        download: "Clique aqui para baixar planilha exemplo.",
        dialog: {
          name: "Nome",
          nameShort: "Nome curto",
          nameLong: "Nome longo",
          nameRequired: "Nome é obrigatório",
          number: "Número",
          numberShort: "Número curto",
          numberLong: "Número longo",
          whatsapp: "Whatsapp",
          email: "E-mail",
          emailInvalid: "E-mail inválido",
          okEdit: "Editar",
          okAdd: "Adicionar",
          add: "Adicionar",
          edit: "Editar",
          cancel: "Cancelar",
        },
        table: {
          name: "Nome",
          number: "Número",
          whatsapp: "Whatsapp",
          email: "E-mail",
          actions: "Ações",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
          importMessage: "Deseja importar os contatos desta planilha? ",
          importTitlte: "Importar",
        },
        toasts: {
          deleted: "Registro excluído",
        },
      },
      campaigns: {
        title: "Campanhas",
        searchPlaceholder: "Pesquisa",
        report: {
          title: "Relatório de",
          title2: "Campanha",
          of: "de",
          validContacts: "Contatos válidos",
          delivered: "Entregues",
          connection: "Conexão",
          contactList: "Lista de Contatos",
          schedule: "Agendamento",
          conclusion: "Conclusão",
        },
        config: {
          interval: "Intervalos",
          randomInterval: "Intervalo Randômico de Disparo",
          biggerInterval: "Intervalo Maior Após",
          greaterInterval: "Intervalo de Disparo Maior",
          noInterval: "Sem Intervalo",
          second: "segundo",
          seconds: "segundos",
          notDefined: "Não definido",
          addVariable: "Adicionar Variável",
          save: "Salvar Configurações",
          shortcut: "Atalho",
          content: "Conteúdo",
          close: "Fechar",
          add: "Adicionar",
        },
        buttons: {
          add: "Nova Campanha",
          contactLists: "Listas de Contatos",
        },
        status: {
          inactive: "Inativa",
          programmed: "Programada",
          inProgress: "Em andamento",
          canceled: "Cancelada",
          finished: "Finalizada",
        },
        table: {
          name: "Nome",
          whatsapp: "Conexão",
          contactList: "Lista de Contatos",
          status: "Status",
          scheduledAt: "Agendamento",
          completedAt: "Concluída",
          confirmation: "Confirmação",
          actions: "Ações",
          notDefined: "Não definida",
          notDefined2: "Não definido",
          notScheduled: "Sem agendamento",
          notConcluded: "Não concluída",
          stopCampaign: "Parar Campanha",
        },
        dialog: {
          new: "Nova Campanha",
          update: "Editar Campanha",
          readonly: "Apenas Visualização",
          form: {
            name: "Nome",
            nameShort: "Nome curto",
            nameLong: "Nome longo",
            helper:
                "Utilize variáveis como {nome}, {numero}, {email} ou defina variáveis personalziadas.",
            nameRequired: "Nome é obrigatório",
            message1: "Mensagem 1",
            message2: "Mensagem 2",
            message3: "Mensagem 3",
            message4: "Mensagem 4",
            message5: "Mensagem 5",
            messagePlaceholder: "Conteúdo da mensagem",
            whatsapp: "Conexão",
            status: "Status",
            scheduledAt: "Agendamento",
            confirmation: "Confirmação",
            contactList: "Lista de Contato",
            tagList: "Lista de Tags",
            fileList: "Lista de Arquivos",
          },
          buttons: {
            add: "Adicionar",
            edit: "Atualizar",
            okadd: "Ok",
            cancel: "Cancelar Disparos",
            restart: "Reiniciar Disparos",
            close: "Fechar",
            attach: "Anexar Arquivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          configSaved: "Configurações salvas",
          success: "Operação realizada com sucesso",
          cancel: "Campanha cancelada",
          restart: "Campanha reiniciada",
          deleted: "Registro excluído",
        },
      },
      subscription: {
        title: "Assinatura",
        testPeriod: "Período de Teste",
        remainingTest: "Seu período de teste termina em",
        remainingTest2: "dias!",
        chargeEmail: "E-mail de cobrança",
        signNow: "Assinar agora!",
      },
      announcements: {
        active: "Ativo",
        inactive: "Inativo",
        title: "Informativos",
        searchPlaceholder: "Pesquisa",
        high: "Alta",
        medium: "Média",
        low: "Baixa",
        buttons: {
          add: "Novo Informativo",
          contactLists: "Listas de Informativos",
        },
        table: {
          priority: "Prioridade",
          title: "Title",
          text: "Texto",
          mediaName: "Arquivo",
          status: "Status",
          actions: "Ações",
        },
        dialog: {
          edit: "Edição de Informativo",
          add: "Novo Informativo",
          update: "Editar Informativo",
          readonly: "Apenas Visualização",
          form: {
            priority: "Prioridade",
            required: "Campo obrigatório",
            title: "Title",
            text: "Texto",
            mediaPath: "Arquivo",
            status: "Status",
          },
          buttons: {
            add: "Adicionar",
            edit: "Atualizar",
            okadd: "Ok",
            cancel: "Cancelar",
            close: "Fechar",
            attach: "Anexar Arquivo",
          },
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        toasts: {
          success: "Operação realizada com sucesso",
          deleted: "Registro excluído",
          info: "Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.",
        },
      },
      campaignsConfig: {
        title: "Configurações de Campanhas",
      },
      queues: {
        title: "Setores & Chatbot",
        table: {
          id: "ID",
          name: "Nome",
          color: "Cor",
          greeting: "Mensagem de saudação",
          actions: "Ações",
          orderQueue: "Ordenação do setor (bot)",
        },
        buttons: {
          add: "Adicionar setor",
        },
        toasts: {
          success: "Setor deletado com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Você tem certeza? Essa ação não pode ser revertida! Os atendimentos desse setor continuarão existindo, mas não terão mais nenhum setor atribuído.",
        },
      },
      queueSelect: {
        inputLabel: "Setores",
      },
      users: {
        title: "Usuários",
        table: {
          id: "ID",
          name: "Nome",
          email: "Email",
          profile: "Perfil",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar usuário",
        },
        toasts: {
          deleted: "Usuário excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
              "Todos os dados do usuário serão perdidos. Os atendimento abertos deste usuário serão movidos para o setor.",
        },
      },
      todolist: {
        input: "Nova tarefa",
        buttons: {
          add: "Adicionar",
          save: "Salvar",
        },
      },
      helps: {
        title: "Central de Ajuda",
      },
      schedules: {
        title: "Agendamentos",
        confirmationModal: {
          deleteTitle: "Você tem certeza que quer excluir este Agendamento?",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
        table: {
          contact: "Contato",
          body: "Mensagem",
          sendAt: "Data de Agendamento",
          sentAt: "Data de Envio",
          status: "Status",
          actions: "Ações",
        },
        messages: {
          date: "Data",
          time: "Hora",
          event: "Evento",
          allDay: "Dia Todo",
          week: "Semana",
          work_week: "Agendamentos",
          day: "Dia",
          month: "Mês",
          previous: "Anterior",
          next: "Próximo",
          yesterday: "Ontem",
          tomorrow: "Amanhã",
          today: "Hoje",
          agenda: "Agenda",
          noEventsInRange: "Não há agendamentos no período.",
          showMore: "mais",
        },
        buttons: {
          add: "Novo Agendamento",
        },
        toasts: {
          deleted: "Agendamento excluído com sucesso.",
        },
      },
      tags: {
        title: "Tags",
        confirmationModal: {
          deleteTitle: "Você tem certeza que quer excluir esta Tag?",
          deleteMessage: "Esta ação não pode ser revertida.",
          deleteAllMessage: "Tem certeza que deseja deletar todas as Tags?",
          deleteAllTitle: "Deletar Todos",
        },
        table: {
          name: "Nome",
          color: "Cor",
          tickets: "Registros Tagdos",
          actions: "Ações",
        },
        buttons: {
          add: "Nova Tag",
          deleteAll: "Deletar Todas",
        },
        toasts: {
          deletedAll: "Todas Tags excluídas com sucesso!",
          deleted: "Tag excluído com sucesso.",
        },
      },
      holidays: {
        title: "Feriados",
        subtitle:
          "Em um feriado cadastrado, o atendimento é tratado como fora do expediente o dia inteiro, mesmo que o horário semanal diria que está aberto.",
        empty: "Nenhum feriado cadastrado.",
        table: {
          date: "Data",
          description: "Descrição",
          recurrent: "Todo ano",
          actions: "Ações",
          yes: "Sim",
          no: "Não",
        },
        buttons: {
          add: "Novo Feriado",
          cancel: "Cancelar",
          okAdd: "Adicionar",
          okEdit: "Salvar",
        },
        modal: {
          addTitle: "Novo Feriado",
          editTitle: "Editar Feriado",
          date: "Data",
          description: "Descrição",
          descriptionPlaceholder: "Ex: Natal, Aniversário da cidade",
          recurrent: "Repete todo ano (ignora o ano cadastrado)",
        },
        confirmationModal: {
          deleteTitle: "Excluir o feriado",
          deleteMessage: "Essa ação não pode ser desfeita.",
        },
        toasts: {
          success: "Feriado salvo com sucesso!",
          deleted: "Feriado excluído com sucesso.",
        },
      },
      settings: {
        schedulesUpdated: "Horários atualizados com sucesso.",
        success: "Configurações salvas com sucesso.",
        title: "Configurações",
        tabs: {
          options: "Opções",
          schedules: "Horários",
          companies: "Empresas",
          plans: "Planos",
          helps: "Ajuda",
        },
        options: {
          toasts: {
            success: "Operação atualizada com sucesso.",
          },
          fields: {
            ratings: {
              title: "Avaliações",
              disabled: "Desabilitadas",
              enabled: "Habilitadas",
            },
            expedientManager: {
              title: "Gerenciamento de Expediente",
              queue: "Setor",
              company: "Empresa",
            },
            ignoreMessages: {
              title: "Ignorar Mensagens de Grupos",
            },
            acceptCall: {
              title: "Aceitar Chamada",
              disabled: "Não aceitar",
              enabled: "Aceitar",
            },
            chatbotType: {
              title: "Tipo Chatbot",
              text: "Texto",
            },
            sendGreetingAccepted: {
              title: "Enviar saudação ao aceitar o ticket",
            },
            sendMsgTransfTicket: {
              title: "Enviar mensagem de transferencia de Setor/agente",
            },
            sendGreetingMessageOneQueues: {
              title: "Enviar saudação quando houver somente 1 setor<",
            },
            disabled: "Desabilitado",
            active: "Ativo",
            enabled: "Habilitado",
          },
          updating: "Atualizando...",
          tabs: {
            integrations: "INTEGRAÇÕES",
          },
        },
        helps: {
          toasts: {
            errorList: "Não foi possível carregar a lista de registros",
            errorOperation: "Não foi possível realizar a operação",
            error:
                "Não foi possível realizar a operação. Verifique se já existe uma helpo com o mesmo nome ou se os campos foram preenchidos corretamente",
            success: "Operação realizada com sucesso!",
          },
          buttons: {
            clean: "Limpar",
            delete: "Excluir",
            save: "Salvar",
          },
          grid: {
            title: "Título",
            description: "Descrição",
            video: "Vídeo",
          },
          confirmModal: {
            title: "Exclusão de Registro",
            confirm: "Deseja realmente excluir esse registro?",
          },
        },
        company: {
          toasts: {
            errorList: "Não foi possível carregar a lista de registros",
            errorOperation: "Não foi possível realizar a operação",
            error:
                "Não foi possível realizar a operação. Verifique se já existe uma empresa com o mesmo nome ou se os campos foram preenchidos corretamente",
            success: "Operação realizada com sucesso!",
          },
          confirmModal: {
            title: "Exclusão de Registro",
            confirm: "Deseja realmente excluir esse registro?",
          },
          form: {
            name: "Nome",
            email: "E-mail",
            phone: "Telefone",
            plan: "Plano",
            status: "Status",
            yes: "Sim",
            no: "Não",
            campanhas: "Campanhas",
            enabled: "Habilitadas",
            disabled: "Desabilitadas",
            dueDate: "Data de vencimento",
            recurrence: "Recorrência",
            monthly: "Mensal",
            expire: "Vencimento",
            createdAt: "Criada Em",
          },
          buttons: {
            clear: "Limpar",
            delete: "Excluir",
            expire: "+ Vencimento",
            user: "Usuário",
            save: "Salvar",
          },
        },
        schedules: {
          form: {
            weekday: "Dia da Semana",
            initialHour: "Hora Inicial",
            finalHour: "Hora Final",
            save: "Salvar",
          },
        },
        settings: {
          userCreation: {
            name: "Criação de usuário",
            options: {
              enabled: "Ativado",
              disabled: "Desativado",
            },
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Atribuído à:",
          buttons: {
            return: "Retornar",
            resolve: "Concluir",
            reopen: "Reabrir",
            accept: "Aceitar",
            download: "Baixar",
          },
        },
        lostCall: "Chamada de voz/vídeo perdida às",
        deletedMessage: "Essa mensagem foi apagada pelo contato",
        edited: "Editada",
        saudation: "Diga olá para seu novo contato!",
      },
      messagesInput: {
        placeholderOpen: "Digite uma mensagem",
        placeholderClosed:
            "Reabra ou aceite esse ticket para enviar uma mensagem.",
        placeholderLocked:
            "Esse atendimento é de outro atendente - você só pode acompanhar.",
        signMessage: "Assinar",
      },
      contactDrawer: {
        header: "Dados do contato",
        buttons: {
          edit: "Editar contato",
        },
        extraInfo: "Outras informações",
        sgp: {
          title: "Cadastro no SGP",
          nome: "Nome",
          cpfCnpj: "CPF/CNPJ",
          planos: "Planos/contratos ativos",
          contratoId: "ID do contrato",
          login: "Login",
          semContratoAtivo: "Nenhum contrato ativo no momento.",
          naoVinculado: "Este contato não tem CPF/CNPJ vinculado.",
          naoEncontrado: "Nenhum cadastro localizado no SGP para este CPF/CNPJ.",
          erro: "Não foi possível consultar o SGP agora.",
          fechar: "Fechar",
          confirmar: "Confirmar",
          botaoDiagnostico: "Diagnóstico de conexão",
          diagnosticoTitulo: "Diagnóstico de conexão",
          semConexao: "Nenhum contrato encontrado pra diagnosticar.",
          online: "Online",
          offline: "Offline",
          ip: "IP atual",
          conectadoDesde: "Conectado desde",
          ultimaQueda: "Última queda",
          semRegistro: "Sem sessão registrada.",
          trafego: "Tráfego",
          atualizadoAs: "Atualizado às",
          atualizarAgora: "Atualizar agora",
          acessarEquipamento: "Acessar equipamento do cliente",
          botaoBoletos: "Ver boletos em aberto",
          botaoDesbloquear: "Desbloquear serviço",
          botaoRetornarIa: "Voltar atendimento para IA",
          boletosTitulo: "Selecionar fatura",
          boletosSubtitulo: "Escolha qual fatura enviar ao cliente",
          semBoletos: "Nenhum boleto em aberto no momento.",
          vencimento: "Vencimento",
          emAberto: "Em aberto",
          valor: "Valor",
          enviar: "Enviar",
          enviado: "Enviado",
          boletoEnviado: "Boleto enviado ao cliente!",
          cancelar: "Cancelar",
          desbloquearTitulo: "Desbloquear serviço",
          desbloquearConfirmacao:
            "Isso vai acionar a liberação por confiança do cliente no SGP (mesma liberação que a IA faz no WhatsApp). Confirma?",
          desbloqueadoSucesso:
            "Liberado até {{data}}. Protocolo: {{protocolo}}",
          retornarIaTitulo: "Voltar atendimento para IA",
          retornarIaConfirmacao:
            "A IA volta a responder o cliente neste ticket, mas ele continua com você (não sai do seu Kanban). Se você mandar uma mensagem, a IA pausa na hora e você assume de novo. Confirma?",
          retornarIaSucesso:
            "IA respondendo por você agora. Mande uma mensagem quando quiser assumir de volta.",
          botaoResumo: "Resumir atendimento",
          resumoTitulo: "Resumo do atendimento",
          botaoDesvincular: "Desvincular CPF/CNPJ",
          desvincularTitulo: "Desvincular CPF/CNPJ",
          desvincularConfirmacao:
            "Isso vai remover o CPF/CNPJ vinculado a este número de WhatsApp. Na próxima vez que o cliente falar com a IA, ela vai pedir o documento de novo. Confirma?",
          desvincularSucesso: "CPF/CNPJ desvinculado deste número.",
          botaoAbrirOs: "Abrir OS",
          abrirOsTitulo: "Abrir Ordem de Serviço",
          abrirOsContrato: "Contrato",
          abrirOsDescricao: "Descrição do problema",
          abrirOsDescricaoPlaceholder:
            "Ex: Cliente sem internet, ONU com luz vermelha piscando",
          abrirOsSucesso: "OS aberta! Protocolo: {{protocolo}} (OS #{{osId}})",
          abrirOsTecnico: "Técnico responsável (opcional)",
          abrirOsSemTecnico: "Sem técnico definido",
          abrirOsAgendamento: "Agendar data/hora (opcional)",
          botaoListarOs: "Listar OS abertas",
          listarOsTitulo: "Ordens de serviço abertas",
          semOsAbertas: "Nenhuma OS aberta no momento.",
          protocolo: "Protocolo",
          dataCadastro: "Aberta em",
          fecharOsBotao: "Fechar OS",
          fecharOsServicoPrestado: "O que foi feito",
          fecharOsData: "Data/hora da finalização",
          fecharOsSucesso: "OS fechada com sucesso!",
        },
      },
      fileModal: {
        title: {
          add: "Adicionar lista de arquivos",
          edit: "Editar lista de arquivos",
        },
        buttons: {
          okAdd: "Salvar",
          okEdit: "Editar",
          cancel: "Cancelar",
          fileOptions: "Adicionar arquivo",
        },
        form: {
          name: "Nome da lista de arquivos",
          message: "Detalhes da lista",
          fileOptions: "Lista de arquivos",
          extraName: "Mensagem para enviar com arquivo",
          extraValue: "Valor da opção",
        },
        formErrors: {
          name: {
            required: "Nome é obrigatório",
            short: "Nome muito curto",
          },
          message: {
            required: "Mensagem é obrigatória",
          },
        },
        success: "Lista de arquivos salva com sucesso!",
      },
      ticketOptionsMenu: {
        schedule: "Agendamento",
        delete: "Deletar",
        transfer: "Transferir",
        registerAppointment: "Observações do Contato",
        appointmentsModal: {
          title: "Observações do Contato",
          textarea: "Observação",
          placeholder: "Insira aqui a informação que deseja registrar",
        },
        confirmationModal: {
          title: "Deletar o ticket",
          titleFrom: "do contato ",
          message:
              "Atenção! Todas as mensagens relacionadas ao ticket serão perdidas.",
        },
        buttons: {
          delete: "Excluir",
          cancel: "Cancelar",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancelar",
        },
      },
      messageOptionsMenu: {
        delete: "Deletar",
        reply: "Responder",
        confirmationModal: {
          title: "Apagar mensagem?",
          message: "Esta ação não pode ser revertida.",
        },
      },
      backendErrors: {
        ERR_INTERNAL_SERVER_ERROR:
            "Ocorreu um erro inesperado. Por favor, tente novamente mais tarde",
        ERR_NO_OTHER_WHATSAPP: "Deve haver pelo menos um WhatsApp padrão.",
        ERR_NO_DEF_WAPP_FOUND:
            "Nenhum WhatsApp padrão encontrado. Verifique a página de conexões.",
        ERR_WAPP_NOT_INITIALIZED:
            "Esta sessão do WhatsApp não foi inicializada. Verifique a página de conexões.",
        ERR_WAPP_CHECK_CONTACT:
            "Não foi possível verificar o contato do WhatsApp. Verifique a página de conexões",
        ERR_WAPP_INVALID_CONTACT: "Este não é um número de Whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA:
            "Não foi possível baixar mídia do WhatsApp. Verifique a página de conexões.",
        ERR_INVALID_CREDENTIALS:
            "Erro de autenticação. Por favor, tente novamente.",
        ERR_USER_DONT_EXISTS:
            "Usuário não encontrado. Verifique o e-mail informado.",
        ERR_SENDING_WAPP_MSG:
            "Erro ao enviar mensagem do WhatsApp. Verifique a página de conexões.",
        ERR_DELETE_WAPP_MSG: "Não foi possível excluir a mensagem do WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Já existe um tíquete aberto para este contato.",
        ERR_SESSION_EXPIRED: "Sessão expirada. Por favor entre.",
        ERR_USER_CREATION_DISABLED:
            "A criação do usuário foi desabilitada pelo administrador.",
        ERR_NO_PERMISSION: "Você não tem permissão para acessar este recurso.",
        ERR_DUPLICATED_CONTACT: "Já existe um contato com este número.",
        ERR_NO_SETTING_FOUND: "Nenhuma configuração encontrada com este ID.",
        ERR_NO_CONTACT_FOUND: "Nenhum contato encontrado com este ID.",
        ERR_NO_TICKET_FOUND: "Nenhum tíquete encontrado com este ID.",
        ERR_TICKET_ALREADY_TAKEN:
            "Esse atendimento já foi puxado por outro atendente.",
        ERR_NO_USER_FOUND: "Nenhum usuário encontrado com este ID.",
        ERR_NO_WAPP_FOUND: "Nenhum WhatsApp encontrado com este ID.",
        ERR_CREATING_MESSAGE: "Erro ao criar mensagem no banco de dados.",
        ERR_CREATING_TICKET: "Erro ao criar tíquete no banco de dados.",
        ERR_FETCH_WAPP_MSG:
            "Erro ao buscar a mensagem no WhtasApp, talvez ela seja muito antiga.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
            "Esta cor já está em uso, escolha outra.",
        ERR_WAPP_GREETING_REQUIRED:
            "A mensagem de saudação é obrigatório quando há mais de um setor.",
      },
    },
  },
};

export { messages };
