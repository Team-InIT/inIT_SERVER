const Sequelize = require("sequelize");

module.exports = class Zzim extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            mNum: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            pNum: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            zNum : {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            }
        }, {
            sequelize,
            timestamps: false,
            modelName: 'Zzim',
            tableName: 'zzims',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Zzim.belongsTo(db.Member, {foreignKey: 'mNum', targetKey: 'mNum'});
        db.Zzim.belongsTo(db.ProjectInfo, {foreignKey: 'pNum', targetKey: 'pNum'});
    }
}