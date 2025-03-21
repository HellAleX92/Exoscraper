namespace ExoscraperGUI
{
    partial class ExoscraperGUI
    {
        /// <summary>
        /// Erforderliche Designervariable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Bereinigt alle verwendeten Ressourcen.
        /// </summary>
        /// <param name="disposing">True, wenn verwaltete Ressourcen gelöscht werden sollen; andernfalls False.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Vom Windows Form-Designer generierter Code

        /// <summary>
        /// Erforderliche Methode für die Designerunterstützung.
        /// Der Inhalt der Methode darf nicht mit dem Code-Editor geändert werden.
        /// </summary>
        private void InitializeComponent()
        {
            btnDownloader = new Button();
            btnHTML2JSON = new Button();
            btnXtractor = new Button();
            txtLog = new TextBox();
            btnStopDownloader = new Button();
            btnStopXtractor = new Button();
            btnStopHTML2JSON = new Button();
            numPageLimit = new NumericUpDown();
            label1 = new Label();
            label2 = new Label();
            ((System.ComponentModel.ISupportInitialize)numPageLimit).BeginInit();
            SuspendLayout();
            // 
            // btnDownloader
            // 
            btnDownloader.Location = new Point(10, 11);
            btnDownloader.Name = "btnDownloader";
            btnDownloader.Size = new Size(139, 28);
            btnDownloader.TabIndex = 0;
            btnDownloader.Text = "Run HTML Downloader";
            btnDownloader.UseVisualStyleBackColor = true;
            btnDownloader.Click += btnDownloader_Click;
            // 
            // btnHTML2JSON
            // 
            btnHTML2JSON.Location = new Point(10, 45);
            btnHTML2JSON.Name = "btnHTML2JSON";
            btnHTML2JSON.Size = new Size(139, 28);
            btnHTML2JSON.TabIndex = 1;
            btnHTML2JSON.Text = "Run HTML2JSON";
            btnHTML2JSON.UseVisualStyleBackColor = true;
            btnHTML2JSON.Click += btnHTML2JSON_Click;
            // 
            // btnXtractor
            // 
            btnXtractor.Location = new Point(10, 79);
            btnXtractor.Name = "btnXtractor";
            btnXtractor.Size = new Size(139, 28);
            btnXtractor.TabIndex = 2;
            btnXtractor.Text = "Run Link Extractor";
            btnXtractor.UseVisualStyleBackColor = true;
            btnXtractor.Click += btnXtractor_Click;
            // 
            // txtLog
            // 
            txtLog.Location = new Point(10, 112);
            txtLog.Multiline = true;
            txtLog.Name = "txtLog";
            txtLog.ScrollBars = ScrollBars.Vertical;
            txtLog.Size = new Size(780, 482);
            txtLog.TabIndex = 3;
            // 
            // btnStopDownloader
            // 
            btnStopDownloader.Location = new Point(651, 12);
            btnStopDownloader.Name = "btnStopDownloader";
            btnStopDownloader.Size = new Size(139, 28);
            btnStopDownloader.TabIndex = 4;
            btnStopDownloader.Text = "Stop Downloading";
            btnStopDownloader.UseVisualStyleBackColor = true;
            btnStopDownloader.Click += btnStopDownloader_Click;
            // 
            // btnStopXtractor
            // 
            btnStopXtractor.Location = new Point(651, 80);
            btnStopXtractor.Name = "btnStopXtractor";
            btnStopXtractor.Size = new Size(139, 28);
            btnStopXtractor.TabIndex = 5;
            btnStopXtractor.Text = "Stop Extracting";
            btnStopXtractor.UseVisualStyleBackColor = true;
            btnStopXtractor.Click += btnStopXtractor_Click;
            // 
            // btnStopHTML2JSON
            // 
            btnStopHTML2JSON.Location = new Point(651, 46);
            btnStopHTML2JSON.Name = "btnStopHTML2JSON";
            btnStopHTML2JSON.Size = new Size(139, 28);
            btnStopHTML2JSON.TabIndex = 6;
            btnStopHTML2JSON.Text = "Stop Converting";
            btnStopHTML2JSON.UseVisualStyleBackColor = true;
            btnStopHTML2JSON.Click += btnStopHTML2JSON_Click;
            // 
            // numPageLimit
            // 
            numPageLimit.Location = new Point(249, 14);
            numPageLimit.Maximum = new decimal(new int[] { 250, 0, 0, 0 });
            numPageLimit.Name = "numPageLimit";
            numPageLimit.Size = new Size(58, 23);
            numPageLimit.TabIndex = 7;
            // 
            // label1
            // 
            label1.AutoSize = true;
            label1.Location = new Point(174, 11);
            label1.Name = "label1";
            label1.Size = new Size(70, 30);
            label1.TabIndex = 8;
            label1.Text = "Select Page:\r\n0 = All";
            // 
            // label2
            // 
            label2.AutoSize = true;
            label2.Location = new Point(467, 94);
            label2.Name = "label2";
            label2.Size = new Size(178, 15);
            label2.TabIndex = 9;
            label2.Text = "©2025 by Alex aka SkankHunt42";
            // 
            // ExoscraperGUI
            // 
            AutoScaleDimensions = new SizeF(7F, 15F);
            AutoScaleMode = AutoScaleMode.Font;
            ClientSize = new Size(802, 606);
            Controls.Add(label2);
            Controls.Add(label1);
            Controls.Add(numPageLimit);
            Controls.Add(btnStopHTML2JSON);
            Controls.Add(btnStopXtractor);
            Controls.Add(btnStopDownloader);
            Controls.Add(txtLog);
            Controls.Add(btnXtractor);
            Controls.Add(btnHTML2JSON);
            Controls.Add(btnDownloader);
            Name = "ExoscraperGUI";
            Text = "ExoScraper GUI";
            ((System.ComponentModel.ISupportInitialize)numPageLimit).EndInit();
            ResumeLayout(false);
            PerformLayout();
        }

        #endregion

        private System.Windows.Forms.Button btnDownloader;
        private System.Windows.Forms.Button btnHTML2JSON;
        private System.Windows.Forms.Button btnXtractor;
        private System.Windows.Forms.TextBox txtLog;
        private Button btnStopDownloader;
        private Button btnStopXtractor;
        private Button btnStopHTML2JSON;
        private NumericUpDown numPageLimit;
        private Label label1;
        private Label label2;
    }
}
