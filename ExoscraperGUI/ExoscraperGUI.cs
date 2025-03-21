using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace ExoscraperGUI
{
    public partial class ExoscraperGUI : Form
    {
        private Process downloaderProcess;
        private Process html2JsonProcess;
        private Process xtractorProcess;

        public ExoscraperGUI()
        {
            InitializeComponent();
            this.Load += ExoscraperGUI_Load;
        }

        private void ExoscraperGUI_Load(object sender, EventArgs e)
        {
            ExtractNodeModules();
        }

        private void btnDownloader_Click(object sender, EventArgs e)
        {
            int pageLimit = (int)numPageLimit.Value;

            // Check if "0" was selected (special case for all pages)
            string arguments = pageLimit == 0 ? "all" : pageLimit.ToString();

            AppendLog(pageLimit == 0
                ? "Starting download for ALL pages..."
                : $"Starting download for {pageLimit} page(s)...");

            downloaderProcess = RunEmbeddedScript("ExoscraperGUI.Resources.HTML_downloader.js", "HTML_downloader.js", arguments);
        }

        private void btnDownloadSinglePage_Click(object sender, EventArgs e)
        {
            int targetPage = (int)numSpecificPage.Value;
            if (targetPage <= 0)
            {
                AppendLog("Bitte eine gültige Seitennummer eingeben.");
                return;
            }

            AppendLog($"Starte Download der Seite {targetPage}...");
            downloaderProcess = RunEmbeddedScript(
                "ExoscraperGUI.Resources.HTML_downloader.js",
                "HTML_downloader.js",
                targetPage.ToString()
            );
        }


        private void btnHTML2JSON_Click(object sender, EventArgs e)
        {
            html2JsonProcess = RunEmbeddedScript("ExoscraperGUI.Resources.HTML2JSON.js", "HTML2JSON.js");
        }

        private void btnXtractor_Click(object sender, EventArgs e)
        {
            xtractorProcess = RunEmbeddedScript("ExoscraperGUI.Resources.StoreLink_Extractor.js", "StoreLink_Extractor.js");
        }

        private void btnStopDownloader_Click(object sender, EventArgs e)
        {
            StopScript(downloaderProcess, "Downloader");
        }

        private void btnStopHTML2JSON_Click(object sender, EventArgs e)
        {
            StopScript(html2JsonProcess, "HTML2JSON");
        }

        private void btnStopXtractor_Click(object sender, EventArgs e)
        {
            StopScript(xtractorProcess, "Xtractor");
            if (xtractorProcess == null || xtractorProcess.HasExited)
            {
                AppendLog("Creating CSV-File with extracted data...");
                RunEmbeddedScript("ExoscraperGUI.Resources.StoreLink_Extractor.js", "StoreLink_Extractor.js", "--merge-csv");
            }
            else
            {
                AppendLog("Extractor process is still running. Cannot create CSV.");
            }
        }

        private void ExtractNodeModules()
        {
            string exePath = AppDomain.CurrentDomain.BaseDirectory;
            string nodeModulesPath = Path.Combine(exePath, "node_modules");

            if (!Directory.Exists(nodeModulesPath))
            {
                AppendLog("Extracting node_modules...");
                foreach (string resourceName in Assembly.GetExecutingAssembly().GetManifestResourceNames())
                {
                    if (resourceName.StartsWith("ExoscraperGUI.Resources.node_modules"))
                    {
                        string relativePath = resourceName.Replace("ExoscraperGUI.Resources.", "").Replace(".", "\\");
                        string outputPath = Path.Combine(nodeModulesPath, relativePath);

                        Directory.CreateDirectory(Path.GetDirectoryName(outputPath));

                        try
                        {
                            using (Stream resourceStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
                            using (FileStream fileStream = new FileStream(outputPath, FileMode.Create, FileAccess.Write))
                            {
                                resourceStream.CopyTo(fileStream);
                            }
                        }
                        catch (Exception ex)
                        {
                            AppendLog($"Error while Extracting: {ex.Message}");
                        }
                    }
                }
            }
        }

        private Process RunEmbeddedScript(string embeddedResourceName, string tempFileName, string arguments = "")
        {
            try
            {
                string exePath = AppDomain.CurrentDomain.BaseDirectory;
                string scriptPath = Path.Combine(exePath, tempFileName);

                using (Stream resourceStream = Assembly.GetExecutingAssembly().GetManifestResourceStream(embeddedResourceName))
                using (FileStream fileStream = new FileStream(scriptPath, FileMode.Create, FileAccess.Write))
                {
                    if (resourceStream == null)
                        throw new Exception($"Resource {embeddedResourceName} not found.");

                    resourceStream.CopyTo(fileStream);
                }

                string nodeModulesPath = Path.Combine(exePath, "Resources", "node_modules");
                if (!Directory.Exists(nodeModulesPath))
                {
                    AppendLog("WARNING: node_modules-Path non-existent.");
                }

                Process nodeProcess = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "node",
                        Arguments = $"{scriptPath} {arguments}",
                        WorkingDirectory = exePath,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        EnvironmentVariables = { ["NODE_PATH"] = nodeModulesPath }
                    }
                };

                nodeProcess.OutputDataReceived += (s, args) => AppendLog(args.Data);
                nodeProcess.ErrorDataReceived += (s, args) => AppendLog($"Error: {args.Data}");

                nodeProcess.Start();
                nodeProcess.BeginOutputReadLine();
                nodeProcess.BeginErrorReadLine();

                AppendLog($"Script started: {embeddedResourceName} with argument {arguments}");
                return nodeProcess;
            }
            catch (Exception ex)
            {
                AppendLog($"Error running script: {ex.Message}");
                return null;
            }
        }

        private void StopScript(Process process, string scriptName)
        {
            if (process != null && !process.HasExited)
            {
                try
                {
                    process.Kill();
                    AppendLog($"{scriptName} script stopped.");
                }
                catch (Exception ex)
                {
                    AppendLog($"Error stopping {scriptName} script: {ex.Message}");
                }
            }
            else
            {
                AppendLog($"{scriptName} script is not running.");
            }
        }

        private void AppendLog(string message)
        {
            if (!string.IsNullOrWhiteSpace(message))
            {
                if (this.IsHandleCreated)
                {
                    txtLog.Invoke((System.Windows.Forms.MethodInvoker)delegate
                    {
                        txtLog.AppendText($"{message}{Environment.NewLine}");
                    });
                }
                else
                {
                    Console.WriteLine(message);
                }
            }
        }
    }
}
