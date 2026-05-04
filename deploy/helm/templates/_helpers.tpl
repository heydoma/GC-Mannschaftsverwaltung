{{/*
Gemeinsame Helm-Helfer für GC-Mannschaftsverwaltung
*/}}

{{- define "gcm.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "gcm.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* Standard-Labels für alle Ressourcen */}}
{{- define "gcm.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/name: {{ include "gcm.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Selector-Labels für Deployments */}}
{{- define "gcm.backendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "gcm.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "gcm.frontendSelectorLabels" -}}
app.kubernetes.io/name: {{ include "gcm.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* Secret-Name */}}
{{- define "gcm.secretName" -}}
{{- if .Values.backend.existingSecret }}
{{- .Values.backend.existingSecret }}
{{- else }}
{{- include "gcm.fullname" . }}-secrets
{{- end }}
{{- end }}

{{/* PostgreSQL Service-Hostname (Bitnami Sub-Chart) */}}
{{- define "gcm.postgresHost" -}}
{{- printf "%s-postgresql" .Release.Name }}
{{- end }}
