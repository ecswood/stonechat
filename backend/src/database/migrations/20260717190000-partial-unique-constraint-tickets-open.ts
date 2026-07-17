import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "Tickets",
      "contactid_companyid_unique"
    );
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "contactid_companyid_unique" ON "Tickets" ("contactId", "companyId", "whatsappId") WHERE status <> 'closed';`
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS "contactid_companyid_unique";`
    );
    await queryInterface.addConstraint(
      "Tickets",
      ["contactId", "companyId", "whatsappId"],
      {
        type: "unique",
        name: "contactid_companyid_unique"
      }
    );
  }
};
