import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { OpenAIProvider } from './providers/openai-provider';
import { ToolRegistry } from './tools/tool.registry';
import { AIAuditLogger } from './logging/ai-audit.logger';
import { PrismaModule } from '../../common/prisma';
import { RbacModule } from '../rbac/rbac.module';

// Tools
import { GetDashboardTool } from './tools/tools/get-dashboard.tool';
import { GetSalesSummaryTool } from './tools/tools/get-sales-summary.tool';
import { GetTopProductsTool } from './tools/tools/get-top-products.tool';
import { GetLowStockTool } from './tools/tools/get-low-stock.tool';
import { GetInventoryValueTool } from './tools/tools/get-inventory-value.tool';
import { GetProfitTool } from './tools/tools/get-profit.tool';

// ReportsService (existing)
import { ReportsModule } from '../reports/reports.module';

/**
 * AI Module — StockFlow AI Assistant Foundation (AI-0).
 *
 * Provides:
 * - POST /ai/chat endpoint
 * - AI Orchestrator with tool execution
 * - OpenAI provider (swappable via interface)
 * - Read-only tool registry
 * - Security context and audit logging
 */
@Module({
  imports: [PrismaModule, ConfigModule, RbacModule, ReportsModule],
  controllers: [AIController],
  providers: [
    // Audit logger
    AIAuditLogger,

    // Tool Registry
    ToolRegistry,

    // Tools (register all read-only tools)
    GetDashboardTool,
    GetSalesSummaryTool,
    GetTopProductsTool,
    GetLowStockTool,
    GetInventoryValueTool,
    GetProfitTool,

    // Provider config
    {
      provide: 'AI_PROVIDER_CONFIG',
      useFactory: (configService: ConfigService) => ({
        apiKey: configService.get<string>('AI_API_KEY', ''),
        model: configService.get<string>('AI_MODEL', 'gpt-4o-mini'),
        temperature: configService.get<number>('AI_TEMPERATURE', 0.7),
        maxTokens: configService.get<number>('AI_MAX_TOKENS', 2048),
        timeoutMs: configService.get<number>('AI_TIMEOUT_MS', 30000),
      }),
      inject: [ConfigService],
    },

    // OpenAI Provider (as AIProvider interface)
    {
      provide: 'AIProvider',
      useFactory: (config: any) => {
        return new OpenAIProvider(config);
      },
      inject: ['AI_PROVIDER_CONFIG'],
    },

    // AI Orchestrator
    AIService,
  ],
  exports: [AIService],
})
export class AIModule {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly getDashboardTool: GetDashboardTool,
    private readonly getSalesSummaryTool: GetSalesSummaryTool,
    private readonly getTopProductsTool: GetTopProductsTool,
    private readonly getLowStockTool: GetLowStockTool,
    private readonly getInventoryValueTool: GetInventoryValueTool,
    private readonly getProfitTool: GetProfitTool,
  ) {
    // Register all read-only tools
    this.toolRegistry.register(this.getDashboardTool);
    this.toolRegistry.register(this.getSalesSummaryTool);
    this.toolRegistry.register(this.getTopProductsTool);
    this.toolRegistry.register(this.getLowStockTool);
    this.toolRegistry.register(this.getInventoryValueTool);
    this.toolRegistry.register(this.getProfitTool);
  }
}
