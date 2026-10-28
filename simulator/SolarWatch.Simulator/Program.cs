using SolarWatch.Simulator;

if (args is ["--help"])
{
    Console.WriteLine(SimulatorOptions.Usage);
    return 0;
}
try
{
    var options = SimulatorOptions.Parse(args);
    using var handler = new HttpClientHandler { AllowAutoRedirect = false };
    using var client = new HttpClient(handler) { BaseAddress = options.ApiUrl, Timeout = TimeSpan.FromSeconds(15) };
    return await SimulatorRunner.RunAsync(options, client, Console.Out);
}
catch (ArgumentException)
{
    Console.Error.WriteLine("Invalid parameters. " + SimulatorOptions.Usage);
    return 1;
}
