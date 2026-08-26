import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  DataType
} from "sequelize-typescript";
import Company from "./Company";

@Table
class Holiday extends Model<Holiday> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  date: string;

  @AllowNull(false)
  @Column
  description: string;

  // Feriados fixos (Natal, Ano Novo) se repetem todo ano - marcar como
  // recorrente evita recadastrar; feriados móveis (Carnaval, Páscoa) ou de
  // ocasião única entram como não recorrentes, com o ano certo.
  @Default(false)
  @Column
  recurrent: boolean;

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

export default Holiday;
