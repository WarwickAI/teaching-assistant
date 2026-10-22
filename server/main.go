package main

import (
	"cmp"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/anthropics/anthropic-sdk-go"

	"teaching-assistant/server/internal/api"
	"teaching-assistant/server/internal/db"
)

type Config struct {
	Address     string
	DatabaseURL string
	Model       string
}

func loadConfig() (Config, error) {
	cfg := Config{
		Address:     cmp.Or(os.Getenv("ADDRESS"), "127.0.0.1:8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Model:       cmp.Or(os.Getenv("MODEL"), "claude-haiku-5-5"),
	}

	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		slog.Error("invalid config", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	handler, err := api.New(db.New(pool), anthropic.NewClient(), cfg.Model)
	if err != nil {
		slog.Error("invalid config", "err", err)
		os.Exit(1)
	}
	httpServer := &http.Server{Addr: cfg.Address, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		httpServer.Shutdown(context.Background()) // lets in-flight chats finish and be saved
	}()
	slog.Info("listening", "addr", cfg.Address)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}
