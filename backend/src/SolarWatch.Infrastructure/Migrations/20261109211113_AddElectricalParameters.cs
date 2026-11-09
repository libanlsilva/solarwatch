using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SolarWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddElectricalParameters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "BatteryVoltageV",
                table: "readings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "GridFrequencyHz",
                table: "readings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "GridVoltageV",
                table: "readings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "InverterTemperatureC",
                table: "readings",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_readings_battery_voltage",
                table: "readings",
                sql: "\"BatteryVoltageV\" IS NULL OR (\"BatteryVoltageV\" >= 0 AND \"BatteryVoltageV\" <= 1000)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_readings_grid_frequency",
                table: "readings",
                sql: "\"GridFrequencyHz\" IS NULL OR (\"GridFrequencyHz\" >= 40 AND \"GridFrequencyHz\" <= 70)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_readings_grid_voltage",
                table: "readings",
                sql: "\"GridVoltageV\" IS NULL OR (\"GridVoltageV\" >= 0 AND \"GridVoltageV\" <= 1000)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_readings_inverter_temperature",
                table: "readings",
                sql: "\"InverterTemperatureC\" IS NULL OR (\"InverterTemperatureC\" >= -40 AND \"InverterTemperatureC\" <= 150)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_readings_battery_voltage",
                table: "readings");

            migrationBuilder.DropCheckConstraint(
                name: "ck_readings_grid_frequency",
                table: "readings");

            migrationBuilder.DropCheckConstraint(
                name: "ck_readings_grid_voltage",
                table: "readings");

            migrationBuilder.DropCheckConstraint(
                name: "ck_readings_inverter_temperature",
                table: "readings");

            migrationBuilder.DropColumn(
                name: "BatteryVoltageV",
                table: "readings");

            migrationBuilder.DropColumn(
                name: "GridFrequencyHz",
                table: "readings");

            migrationBuilder.DropColumn(
                name: "GridVoltageV",
                table: "readings");

            migrationBuilder.DropColumn(
                name: "InverterTemperatureC",
                table: "readings");
        }
    }
}
