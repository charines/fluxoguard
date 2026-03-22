-- Base de Dados FluxoGuard
-- Tabelas fundamentais para o sistema

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `tipo` ENUM('ADMIN', 'PARCEIRO') DEFAULT 'PARCEIRO',
  `cnpj_cpf` VARCHAR(20) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_email` (`email`),
  UNIQUE KEY `idx_users_cnpj_cpf` (`cnpj_cpf`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabela de Transações
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `parceiro_id` INT DEFAULT NULL,
  `valor_liberado` FLOAT DEFAULT 0.0,
  `valor_ajustado` FLOAT DEFAULT 0.0,
  `status` ENUM('PENDENTE', 'AGUARDANDO_NF', 'PAGO', 'ARQUIVADO') DEFAULT 'PENDENTE',
  `hash_link` VARCHAR(255) DEFAULT NULL,
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_transactions_hash` (`hash_link`),
  KEY `fk_transactions_user` (`parceiro_id`),
  CONSTRAINT `fk_transactions_user` FOREIGN KEY (`parceiro_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabela de Tokens de Autenticação
CREATE TABLE IF NOT EXISTS `auth_tokens` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT DEFAULT NULL,
  `token` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tokens_token` (`token`),
  KEY `fk_tokens_user` (`user_id`),
  CONSTRAINT `fk_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Inserção de um usuário Admin inicial (opcional)
-- INSERT INTO `users` (nome, email, tipo, cnpj_cpf) VALUES ('Administrador', 'admin@fluxoguard.com.br', 'ADMIN', '00000000000000');
