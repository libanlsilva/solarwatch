using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SolarWatch.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialReadings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "readings",
                columns: table => new
                {
                    InstallationId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    MeasuredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SolarPowerW = table.Column<double>(type: "double precision", nullable: false),
                    ConsumptionPowerW = table.Column<double>(type: "double precision", nullable: false),
                    BatteryStateOfChargePercent = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_readings", x => new { x.InstallationId, x.MeasuredAt });
                    table.CheckConstraint("ck_readings_battery", "\"BatteryStateOfChargePercent\" >= 0 AND \"BatteryStateOfChargePercent\" <= 100");
                    table.CheckConstraint("ck_readings_consumption", "\"ConsumptionPowerW\" >= 0 AND \"ConsumptionPowerW\" < 'Infinity'::double precision");
                    table.CheckConstraint("ck_readings_installation", "\"InstallationId\" = 'residential-demo'");
                    table.CheckConstraint("ck_readings_solar", "\"SolarPowerW\" >= 0 AND \"SolarPowerW\" < 'Infinity'::double precision");
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "readings");
        }
    }
}
