package server

import (
	"errors"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/open-pencil/open-pencil/backend/internal/docstore"
)

type Config struct {
	DataDir        string
	FrontendOrigin string
	AuthRequired   bool
	InternalToken  string
	DevAuthEmail   string
	DevAuthName    string
	LoginURL       string
	LogoutURL      string
	MCPUpstream    string
}

type SessionResponse struct {
	Authenticated bool      `json:"authenticated"`
	User          *UserInfo `json:"user,omitempty"`
	LoginURL      string    `json:"loginUrl"`
	LogoutURL     string    `json:"logoutUrl"`
}

type UserInfo struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type documentCreateRequest struct {
	Name string `json:"name"`
}

type documentResponse struct {
	Document   *docstore.DocumentMeta `json:"document"`
	ContentURL string                 `json:"contentUrl"`
}

func New(cfg Config, store *docstore.Store) (*gin.Engine, error) {
	if err := store.Ensure(); err != nil {
		return nil, err
	}

	engine := gin.New()
	engine.Use(gin.Logger(), gin.Recovery(), corsMiddleware(cfg))

	engine.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	engine.GET("/api/auth/session", func(c *gin.Context) {
		session := resolveSession(cfg, c.Request)
		if !session.Authenticated {
			c.JSON(http.StatusUnauthorized, session)
			return
		}
		c.JSON(http.StatusOK, session)
	})

	api := engine.Group("/api")
	api.Use(authRequired(cfg))
	api.POST("/documents", func(c *gin.Context) {
		var req documentCreateRequest
		if c.Request.Body != nil {
			_ = c.ShouldBindJSON(&req)
		}
		meta, err := store.CreateDocument(strings.TrimSpace(req.Name))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, documentPayload(meta))
	})

	api.GET("/documents/:id", func(c *gin.Context) {
		meta, err := store.GetDocument(c.Param("id"))
		if err != nil {
			renderStoreError(c, err)
			return
		}
		c.JSON(http.StatusOK, documentPayload(meta))
	})

	api.GET("/documents/:id/content", func(c *gin.Context) {
		data, meta, err := store.ReadContent(c.Param("id"))
		if err != nil {
			renderStoreError(c, err)
			return
		}
		if len(data) == 0 {
			c.Status(http.StatusNoContent)
			return
		}
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Content-Disposition", "inline; filename=\""+safeFilename(meta.Name)+".fig\"")
		c.Data(http.StatusOK, "application/octet-stream", data)
	})

	api.PUT("/documents/:id/content", func(c *gin.Context) {
		data, err := c.GetRawData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
			return
		}
		name := strings.TrimSpace(c.GetHeader("X-Document-Name"))
		meta, err := store.WriteContent(c.Param("id"), name, data)
		if err != nil {
			renderStoreError(c, err)
			return
		}
		c.JSON(http.StatusOK, documentPayload(meta))
	})

	if cfg.MCPUpstream != "" {
		proxy, err := newReverseProxy(cfg.MCPUpstream)
		if err != nil {
			return nil, err
		}
		engine.Any("/mcp", gin.WrapH(proxy))
		engine.Any("/mcp/*path", gin.WrapH(proxy))
	}

	return engine, nil
}

func corsMiddleware(cfg Config) gin.HandlerFunc {
	config := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Authorization", "Content-Type", "X-Document-Name", "mcp-session-id", "mcp-protocol-version", "x-mcp-token"},
		ExposeHeaders:    []string{"mcp-session-id", "mcp-protocol-version"},
		AllowCredentials: true,
	}
	if cfg.FrontendOrigin == "" {
		config.AllowAllOrigins = true
	} else {
		config.AllowOrigins = strings.Split(cfg.FrontendOrigin, ",")
		for i, origin := range config.AllowOrigins {
			config.AllowOrigins[i] = strings.TrimSpace(origin)
		}
	}
	return cors.New(config)
}

func authRequired(cfg Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		if hasInternalAccess(cfg, c.Request) {
			c.Next()
			return
		}
		session := resolveSession(cfg, c.Request)
		if !session.Authenticated {
			c.AbortWithStatusJSON(http.StatusUnauthorized, session)
			return
		}
		c.Set("session", session)
		c.Next()
	}
}

func hasInternalAccess(cfg Config, req *http.Request) bool {
	if strings.TrimSpace(cfg.InternalToken) == "" {
		return false
	}
	return strings.TrimSpace(req.Header.Get("X-Internal-Token")) == strings.TrimSpace(cfg.InternalToken)
}

func resolveSession(cfg Config, req *http.Request) SessionResponse {
	session := SessionResponse{
		Authenticated: true,
		LoginURL:      defaultString(cfg.LoginURL, "/oauth2/sign_in"),
		LogoutURL:     defaultString(cfg.LogoutURL, "/oauth2/sign_out"),
	}

	if !cfg.AuthRequired {
		session.User = &UserInfo{
			Email: defaultString(cfg.DevAuthEmail, "dev@wanbu.local"),
			Name:  defaultString(cfg.DevAuthName, "Local Developer"),
		}
		return session
	}

	email := firstHeader(req,
		"X-Auth-Request-Email",
		"X-Forwarded-Email",
		"Cf-Access-Authenticated-User-Email",
	)
	if email == "" {
		session.Authenticated = false
		return session
	}

	session.User = &UserInfo{
		Email: email,
		Name: firstNonEmpty(
			firstHeader(req, "X-Auth-Request-User", "X-Forwarded-User"),
			email,
		),
	}
	return session
}

func documentPayload(meta *docstore.DocumentMeta) documentResponse {
	return documentResponse{
		Document:   meta,
		ContentURL: "/api/documents/" + meta.ID + "/content",
	}
}

func renderStoreError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, docstore.ErrDocumentNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func newReverseProxy(rawURL string) (*httputil.ReverseProxy, error) {
	target, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	return httputil.NewSingleHostReverseProxy(target), nil
}

func safeFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "document"
	}
	return strings.ReplaceAll(name, "\"", "")
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func firstHeader(req *http.Request, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(req.Header.Get(key)); value != "" {
			return value
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
