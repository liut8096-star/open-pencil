package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/open-pencil/open-pencil/backend/internal/docstore"
	"github.com/open-pencil/open-pencil/backend/internal/server"
)

func main() {
	cfg := server.Config{
		DataDir:        defaultString(os.Getenv("DATA_DIR"), filepath.Join("backend", "data")),
		FrontendOrigin: strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN")),
		AuthRequired:   parseBool(os.Getenv("AUTH_REQUIRED")),
		InternalToken:  strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN")),
		DevAuthEmail:   strings.TrimSpace(os.Getenv("DEV_AUTH_EMAIL")),
		DevAuthName:    strings.TrimSpace(os.Getenv("DEV_AUTH_NAME")),
		LoginURL:       strings.TrimSpace(os.Getenv("LOGIN_URL")),
		LogoutURL:      strings.TrimSpace(os.Getenv("LOGOUT_URL")),
		MCPUpstream:    strings.TrimSpace(os.Getenv("MCP_UPSTREAM")),
	}

	store := docstore.New(cfg.DataDir)
	engine, err := server.New(cfg, store)
	if err != nil {
		log.Fatal(err)
	}

	addr := defaultString(os.Getenv("ADDR"), ":8080")
	log.Printf("wanbu-api listening on %s", addr)
	log.Fatal(engine.Run(addr))
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
