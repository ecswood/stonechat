import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt
} from "sequelize-typescript";
import Queue from "./Queue";
import Company from "./Company";

@Table
class Prompt extends Model<Prompt> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  prompt: string;

  // Pedido do Edison (2026-08-26): template completo do prompt de sistema
  // (saudação, fluxo técnico, frases de Ação), editável pelo painel Open.Ai.
  // Quando vazio, o código usa DEFAULT_SYSTEM_TEMPLATE (ver
  // helpers/DefaultSystemTemplate.ts) - nunca fica sem prompt de sistema.
  @AllowNull
  @Column
  systemTemplate: string;

  @AllowNull(false)
  @Column
  apiKey: string;

  @Column({ defaultValue: 10 })
  maxMessages: number;

  @Column({ defaultValue: 100 })
  maxTokens: number;

  @Column({ defaultValue: 1 })
  temperature: number;

  @Column({ defaultValue: 0 })
  promptTokens: number;

  @Column({ defaultValue: 0 })
  completionTokens: number;

  @Column({ defaultValue: 0 })
  totalTokens: number;

  @Column
  model: string;

  @AllowNull
  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Prompt;
