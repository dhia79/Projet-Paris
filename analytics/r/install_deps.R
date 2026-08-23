#!/usr/bin/env Rscript
# Installs the packages the analytics scripts need. Run once per machine or
# container image:  Rscript install_deps.R

packages <- c("DBI", "RMariaDB", "dplyr", "readr", "ggplot2", "scales", "knitr", "rmarkdown")

missing <- packages[!packages %in% rownames(installed.packages())]

if (length(missing) == 0) {
  message("all analytics packages already installed")
} else {
  message("installing: ", paste(missing, collapse = ", "))
  install.packages(missing, repos = "https://cloud.r-project.org")
}
